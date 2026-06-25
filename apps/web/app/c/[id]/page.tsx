"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSSE } from "@/hooks/use-sse";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  Send,
  Wrench,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

type ApprovalDecision = "APPROVED" | "DENIED" | "EXPIRED";

type EventType =
  | "thinking"
  | "assistant_message"
  | "tool_call_intent"
  | "tool_call_result"
  | "tool_call_blocked"
  | "approval_requested"
  | "approval_decided"
  | "error"
  | "connected"
  | "user_message";

interface SSEEvent {
  type: EventType;
  timestamp: string;
  conversationId?: string;
  data: any;
}

// ─── useCountdown ─────────────────────────────────────────────────────────────
// Returns a formatted "M:SS" string that counts down to `expiresAt`.
// Updates every second. Returns "0:00" when expired.
function useCountdown(expiresAt: string | undefined): string {
  const calc = useCallback(() => {
    if (!expiresAt) return "0:00";
    const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
    const totalSecs = Math.floor(remaining / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, [expiresAt]);

  const [display, setDisplay] = useState(calc);

  useEffect(() => {
    setDisplay(calc());
    const interval = setInterval(() => setDisplay(calc()), 1000);
    return () => clearInterval(interval);
  }, [calc]);

  return display;
}

// ─── ApprovalCountdown ────────────────────────────────────────────────────────
// Small badge rendered inside a pending approval card.
function ApprovalCountdown({ expiresAt }: { expiresAt: string }) {
  const countdown = useCountdown(expiresAt);
  const isUrgent =
    new Date(expiresAt).getTime() - Date.now() < 60_000; // < 1 min

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        isUrgent
          ? "bg-red-500/15 text-red-600 dark:text-red-400"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      }`}
    >
      <Clock className="h-3 w-3" />
      Expires in {countdown}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const firstMessageSent = useRef(false);

  const API_BASE = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

  const { events, isConnected, setEvents } = useSSE<SSEEvent>(
    conversationId
      ? `${API_BASE}/stream/agent/${conversationId}`
      : null
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation history + pending approvals from the DB on first mount.
  useEffect(() => {
    if (!conversationId || historyLoaded) return;

    async function loadHistory() {
      try {
        // 1. Chat history (user + assistant messages)
        const [logsRes, pendingRes] = await Promise.all([
          fetch(`${API_BASE}/api/conversations/${conversationId}`),
          fetch(`${API_BASE}/api/approvals/pending/${conversationId}`),
        ]);

        const logs: { role: string; content: string; createdAt: string }[] =
          await logsRes.json();

        const historyEvents: SSEEvent[] = logs
          .filter((log) => log.role === "user" || log.role === "assistant")
          .map((log) => ({
            type: log.role === "user" ? "user_message" : "assistant_message",
            timestamp: log.createdAt,
            conversationId,
            data: { content: log.content },
          }));

        // 2. Re-hydrate any still-PENDING approvals so the user can act on them
        //    even after navigating away and returning.
        let approvalEvents: SSEEvent[] = [];
        if (pendingRes.ok) {
          const pendingApprovals: {
            approvalId: string;
            toolName: string;
            serverName: string;
            arguments: Record<string, unknown>;
            expiresAt: string;
            createdAt: string;
          }[] = await pendingRes.json();

          approvalEvents = pendingApprovals.map((a) => ({
            type: "approval_requested" as const,
            timestamp: a.createdAt,
            conversationId,
            data: {
              approvalId: a.approvalId,
              toolName: a.toolName,
              serverName: a.serverName,
              arguments: a.arguments,
              expiresAt: a.expiresAt,
            },
          }));
        }

        // Merge and sort chronologically so approvals appear in the right place
        const allEvents = [...historyEvents, ...approvalEvents].sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        if (allEvents.length > 0) {
          setEvents(allEvents);
        }
      } catch (err) {
        console.error("Failed to load conversation history:", err);
      } finally {
        setHistoryLoaded(true);
      }
    }

    loadHistory();
  }, [conversationId, historyLoaded, setEvents, API_BASE]);

  // Auto-send the first message stashed in sessionStorage (new conversations).
  useEffect(() => {
    if (!conversationId || !historyLoaded || firstMessageSent.current) return;

    const key = `gk:firstMessage:${conversationId}`;
    const firstMessage = sessionStorage.getItem(key);
    if (!firstMessage) return;

    sessionStorage.removeItem(key);
    firstMessageSent.current = true;

    const timer = setTimeout(() => {
      sendMessage(firstMessage);
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, historyLoaded]);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !conversationId) return;

    setEvents((prev) => [
      ...prev,
      {
        type: "user_message",
        timestamp: new Date().toISOString(),
        conversationId,
        data: { content: text },
      },
    ]);

    setIsLoading(true);

    try {
      await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, conversationId }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const text = input.trim();
    setInput("");
    await sendMessage(text);
  };

  const handleApproval = async (
    approvalId: string,
    decision: "APPROVED" | "DENIED"
  ) => {
    try {
      await fetch(`${API_BASE}/api/approvals/${approvalId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Agent Workspace</h1>
          {isConnected ? (
            <span className="ml-2 flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
          ) : (
            <span className="ml-2 flex h-2 w-2 rounded-full bg-muted" />
          )}
        </div>
        <div className="ml-auto">
          <span className="block max-w-[200px] truncate font-mono text-xs text-muted-foreground/60">
            {conversationId}
          </span>
        </div>
      </header>

      {/* Main Chat Area */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-8">
          {events.filter((e) => e.type !== "connected").length === 0 &&
            historyLoaded && (
              <div className="mt-20 flex flex-col items-center justify-center gap-4 text-center text-muted-foreground">
                <ShieldAlert className="h-12 w-12 text-primary/40" />
                <div>
                  <h3 className="text-lg font-medium text-foreground">
                    Secure AI Agent
                  </h3>
                  <p className="mt-1 max-w-sm text-sm">
                    Tool calls will be displayed inline and subject to real-time
                    policy evaluation.
                  </p>
                </div>
              </div>
            )}

          {events.map((evt, idx) => {
            if (evt.type === "user_message") {
              return (
                <div
                  key={idx}
                  className="flex animate-in justify-end fade-in slide-in-from-bottom-2"
                >
                  <div className="max-w-[85%] rounded-xl bg-primary p-4 text-primary-foreground shadow-sm">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {evt.data.content}
                    </p>
                  </div>
                </div>
              );
            }

            if (evt.type === "thinking") {
              if (idx !== events.length - 1) return null;
              return (
                <div
                  key={idx}
                  className="flex animate-in justify-start fade-in slide-in-from-bottom-2"
                >
                  <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Thinking…
                    </span>
                  </div>
                </div>
              );
            }

            if (evt.type === "tool_call_intent") {
              const isResolved = events
                .slice(idx + 1)
                .some(
                  (e) =>
                    (e.type === "tool_call_result" ||
                      e.type === "tool_call_blocked" ||
                      e.type === "approval_requested") &&
                    e.data?.toolName === evt.data.toolName
                );
              if (isResolved) return null;

              return (
                <Card
                  key={idx}
                  className="max-w-[85%] border-dashed bg-card p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Wrench className="h-4 w-4 animate-pulse text-muted-foreground" />
                    <span className="font-mono text-xs font-semibold">
                      Executing: {evt.data.toolName}
                    </span>
                  </div>
                  <pre className="overflow-x-auto rounded bg-muted p-2 text-xs text-muted-foreground">
                    {JSON.stringify(evt.data.arguments, null, 2)}
                  </pre>
                </Card>
              );
            }

            if (evt.type === "tool_call_result") {
              return (
                <Card
                  key={idx}
                  className="max-w-[85%] border-green-500/30 bg-green-500/5 p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="font-mono text-xs font-bold text-green-600 dark:text-green-400">
                        ALLOWED: {evt.data.toolName}
                      </span>
                    </div>
                  </div>
                  <pre className="mt-2 max-h-40 overflow-x-auto rounded border border-green-500/10 bg-background/50 p-2 text-xs whitespace-pre-wrap">
                    {typeof evt.data.result === "string"
                      ? evt.data.result
                      : JSON.stringify(evt.data.result, null, 2)}
                  </pre>
                </Card>
              );
            }

            if (evt.type === "tool_call_blocked") {
              return (
                <Card
                  key={idx}
                  className="max-w-[85%] border-red-500/30 bg-red-500/5 p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">
                      BLOCKED: {evt.data.toolName}
                    </span>
                  </div>
                  <p className="text-xs font-medium text-red-600/80 dark:text-red-400/80">
                    Reason: {evt.data.reason}
                  </p>
                </Card>
              );
            }

            if (evt.type === "approval_requested") {
              const decisionEvent = events
                .slice(idx + 1)
                .find(
                  (e) =>
                    e.type === "approval_decided" &&
                    e.data?.approvalId === evt.data.approvalId
                );

              const decision: ApprovalDecision | undefined =
                decisionEvent?.data?.decision;
              const isPending = !decisionEvent;
              const isApproved = decision === "APPROVED";
              const isExpired = decision === "EXPIRED";
              // DENIED covers both explicit rejection and expired (fallback)

              return (
                <Card
                  key={idx}
                  className={`max-w-[85%] p-4 shadow-sm transition-colors ${
                    isPending
                      ? "border-orange-500/40 bg-orange-500/10 shadow-orange-500/10"
                      : isApproved
                      ? "border-green-500/30 bg-green-500/5"
                      : isExpired
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-red-500/30 bg-red-500/5"
                  }`}
                >
                  {/* Header row */}
                  <div className="mb-2 flex items-center gap-2">
                    {isPending ? (
                      <ShieldAlert className="h-4 w-4 animate-pulse text-orange-500" />
                    ) : isApproved ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : isExpired ? (
                      <Clock className="h-4 w-4 text-amber-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}

                    <span
                      className={`font-mono text-xs font-bold ${
                        isPending
                          ? "text-orange-600 dark:text-orange-400"
                          : isApproved
                          ? "text-green-600 dark:text-green-400"
                          : isExpired
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isPending
                        ? `ACTION REQUIRED: ${evt.data.toolName}`
                        : isApproved
                        ? `DECISION: APPROVED`
                        : isExpired
                        ? `TIMED OUT — No response`
                        : `DECISION: REJECTED`}
                    </span>

                    {/* Live countdown badge — only shown while pending */}
                    {isPending && evt.data.expiresAt && (
                      <div className="ml-auto">
                        <ApprovalCountdown expiresAt={evt.data.expiresAt} />
                      </div>
                    )}
                  </div>

                  {/* Pending description */}
                  {isPending && (
                    <div className="mb-3 text-xs text-muted-foreground">
                      The agent wants to execute this tool. Policy requires your
                      approval.
                    </div>
                  )}

                  {/* Expired description */}
                  {isExpired && (
                    <div className="mb-3 text-xs text-amber-600/80 dark:text-amber-400/80">
                      No decision was made within the allowed time. The tool
                      call was automatically rejected.
                    </div>
                  )}

                  {/* Arguments */}
                  <pre className="mb-3 max-h-40 overflow-x-auto rounded border border-foreground/5 bg-background/50 p-2 text-xs whitespace-pre-wrap">
                    {JSON.stringify(evt.data.arguments, null, 2)}
                  </pre>

                  {/* Action buttons — only shown while pending */}
                  {isPending && (
                    <div className="mt-2 flex w-full items-center gap-2">
                      <Button
                        size="sm"
                        id={`approve-${evt.data.approvalId}`}
                        className="flex-1 bg-green-600 text-white hover:bg-green-700"
                        onClick={() =>
                          handleApproval(evt.data.approvalId, "APPROVED")
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        id={`reject-${evt.data.approvalId}`}
                        variant="destructive"
                        className="flex-1"
                        onClick={() =>
                          handleApproval(evt.data.approvalId, "DENIED")
                        }
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </Card>
              );
            }

            if (evt.type === "assistant_message") {
              return (
                <div
                  key={idx}
                  className="flex animate-in justify-start fade-in slide-in-from-bottom-2"
                >
                  <div className="max-w-[85%] rounded-xl border bg-card p-4 shadow-sm">
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {evt.data.content}
                    </p>
                  </div>
                </div>
              );
            }

            return null;
          })}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="sticky bottom-0 z-10 border-t bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="relative mx-auto flex max-w-3xl items-center">
          <Input
            placeholder="Ask Gatekeeper to manage secrets…"
            className="h-12 rounded-xl border-muted-foreground/20 bg-muted/30 pr-12 text-base shadow-sm focus-visible:ring-primary/50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            disabled={isLoading || !isConnected}
          />
          <Button
            size="icon"
            className="absolute right-1 h-10 w-10 rounded-lg shadow-none transition-transform hover:scale-105"
            onClick={handleSend}
            disabled={isLoading || !input.trim() || !isConnected}
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="ml-0.5 h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
