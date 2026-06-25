"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUGGESTIONS = [
  "List all secrets in the prod namespace",
  "Get the stripe_key from prod",
  "What secrets exist in dev?",
  "Delete the api_key from dev",
];

export default function HomePage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const startConversation = async (message: string) => {
    if (!message.trim() || isStarting) return;

    setIsStarting(true);

    const conversationId = crypto.randomUUID();

    // Store first message in sessionStorage so the conversation page can
    // auto-send it after connecting to the SSE stream.
    // Using sessionStorage avoids the Suspense boundary required by useSearchParams.
    sessionStorage.setItem(`gk:firstMessage:${conversationId}`, message.trim());

    router.push(`/c/${conversationId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      startConversation(input);
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 via-background to-background" />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      {/* Hero */}
      <div className="relative z-10 mb-10 flex flex-col items-center px-4 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 shadow-lg shadow-primary/10">
          <ShieldAlert className="h-8 w-8 text-primary" />
        </div>
        <h1 className="mb-3 bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          Gatekeeper
        </h1>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          A policy-controlled AI agent for secret management. Every tool call is
          evaluated against your guardrails in real-time.
        </p>
      </div>

      {/* Input */}
      <div className="relative z-10 w-full max-w-2xl px-4">
        <div className="relative flex items-center">
          <Input
            autoFocus
            placeholder="Ask Gatekeeper to manage secrets…"
            className="h-14 rounded-2xl border-muted-foreground/20 bg-card/80 pr-14 text-base shadow-lg backdrop-blur focus-visible:ring-primary/50"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isStarting}
          />
          <Button
            size="icon"
            className="absolute right-2 h-10 w-10 rounded-xl transition-transform hover:scale-105"
            onClick={() => startConversation(input)}
            disabled={isStarting || !input.trim()}
          >
            <Send className="ml-0.5 h-4 w-4" />
          </Button>
        </div>

        {/* Suggestion chips */}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:bg-muted hover:text-foreground"
              onClick={() => startConversation(s)}
              disabled={isStarting}
            >
              <Sparkles className="mr-1.5 inline h-3 w-3 opacity-60" />
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
