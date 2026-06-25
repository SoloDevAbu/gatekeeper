"use client";

import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";

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

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const conversationId = params.id;

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const firstMessageSent = useRef(false);

  const { events, isConnected, setEvents } = useSSE<SSEEvent>(
    conversationId
      ? `http://localhost:3001/stream/agent/${conversationId}`
      : null
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversation history from the DB on first mount
  useEffect(() => {
    if (!conversationId || historyLoaded) return;

    async function loadHistory() {
      try {
        const res = await fetch(
          `http://localhost:3001/api/conversations/${conversationId}`
        );
        const logs: { role: string; content: string; createdAt: string }[] =
          await res.json();

        // Map DB logs to SSE-style events so the existing renderer handles them
        const historyEvents: SSEEvent[] = logs
          .filter((log) => log.role === "user" || log.role === "assistant")
          .map((log) => ({
            type: log.role === "user" ? "user_message" : "assistant_message",
            timestamp: log.createdAt,
            conversationId,
            data: { content: log.content },
          }));

        if (historyEvents.length > 0) {
          setEvents(historyEvents);
        }
      } catch (err) {
        console.error("Failed to load conversation history:", err);
      } finally {
        setHistoryLoaded(true);
      }
    }

    loadHistory();
  }, [conversationId, historyLoaded, setEvents]);

  // If this is a brand-new conversation started from the landing page,
  // the first message was stashed in sessionStorage. Auto-send it once
  // history is loaded (ensures we don't double-send on a reload).
  useEffect(() => {
    if (!conversationId || !historyLoaded || firstMessageSent.current) return;

    const key = `gk:firstMessage:${conversationId}`;
    const firstMessage = sessionStorage.getItem(key);
    if (!firstMessage) return;

    // Remove immediately so a page reload doesn't re-send
    sessionStorage.removeItem(key);
    firstMessageSent.current = true;

    // Slight delay so the SSE connection has time to open
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

    // Optimistically append the user message
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
      await fetch("http://localhost:3001/api/chat", {
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
      await fetch(`http://localhost:3001/api/approvals/${approvalId}/decide`, {
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

              return (
                <Card
                  key={idx}
                  className={`max-w-[85%] p-4 shadow-sm transition-colors ${
                    decisionEvent
                      ? decisionEvent.data.decision === "APPROVED"
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-red-500/30 bg-red-500/5"
                      : "border-orange-500/40 bg-orange-500/10 shadow-orange-500/10"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldAlert
                      className={`h-4 w-4 ${
                        decisionEvent
                          ? decisionEvent.data.decision === "APPROVED"
                            ? "text-green-500"
                            : "text-red-500"
                          : "animate-pulse text-orange-500"
                      }`}
                    />
                    <span
                      className={`font-mono text-xs font-bold ${
                        decisionEvent
                          ? decisionEvent.data.decision === "APPROVED"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                          : "text-orange-600 dark:text-orange-400"
                      }`}
                    >
                      {decisionEvent
                        ? `DECISION: ${decisionEvent.data.decision}`
                        : `ACTION REQUIRED: ${evt.data.toolName}`}
                    </span>
                  </div>

                  {!decisionEvent && (
                    <div className="mb-3 text-xs text-muted-foreground">
                      The agent wants to execute this tool. Policy requires your
                      approval.
                    </div>
                  )}

                  <pre className="mb-3 max-h-40 overflow-x-auto rounded border border-foreground/5 bg-background/50 p-2 text-xs whitespace-pre-wrap">
                    {JSON.stringify(evt.data.arguments, null, 2)}
                  </pre>

                  {!decisionEvent && (
                    <div className="mt-2 flex items-center gap-2">
                      <Button
                        size="sm"
                        className="w-full bg-green-600 text-white hover:bg-green-700"
                        onClick={() =>
                          handleApproval(evt.data.approvalId, "APPROVED")
                        }
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="w-full"
                        onClick={() =>
                          handleApproval(evt.data.approvalId, "DENIED")
                        }
                      >
                        Deny
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
