"use client"

import { useState, useRef, useEffect } from "react"
import { useSSE } from "@/hooks/use-sse"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card } from "@/components/ui/card"
import { Loader2, Send, Wrench, ShieldAlert, CheckCircle2, XCircle } from "lucide-react"

type EventType = "thinking" | "assistant_message" | "tool_call_intent" | "tool_call_result" | "tool_call_blocked" | "approval_requested" | "approval_decided" | "error" | "connected"

interface SSEEvent {
  type: EventType
  timestamp: string
  conversationId?: string
  data: any
}

interface Message {
  id: string
  role: "user" | "agent"
  content: string
}

export default function ChatPage() {
  const [input, setInput] = useState("")
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const { events, isConnected } = useSSE<SSEEvent>(
    conversationId ? `http://localhost:3001/stream/agent/${conversationId}` : null
  )

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, events])

  const handleSend = async () => {
    if (!input.trim()) return
    
    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { id: Date.now().toString(), role: "user", content: userMessage }])
    setIsLoading(true)
    
    try {
      const res = await fetch("http://localhost:3001/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMessage, conversationId }),
      })
      
      const data = await res.json()
      
      if (!conversationId && data.conversationId) {
        setConversationId(data.conversationId)
      }
      
      setIsLoading(false)
    } catch (err) {
      console.error(err)
      setIsLoading(false)
    }
  }

  const handleApproval = async (approvalId: string, decision: "APPROVED" | "DENIED") => {
    try {
      await fetch(`http://localhost:3001/api/approvals/${approvalId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision })
      })
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="flex flex-col h-screen w-full relative">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-6 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 sticky top-0">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">Agent Workspace</h1>
          {isConnected ? (
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse ml-2" />
          ) : (
            <span className="flex h-2 w-2 rounded-full bg-muted ml-2" />
          )}
        </div>
      </header>

      {/* Main Chat Area */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="flex flex-col gap-6 max-w-3xl mx-auto pb-8">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center text-center mt-20 text-muted-foreground gap-4">
              <ShieldAlert className="h-12 w-12 text-primary/40" />
              <div>
                <h3 className="text-lg font-medium text-foreground">Secure AI Agent</h3>
                <p className="text-sm max-w-sm mt-1">
                  Start a conversation. Tool calls will be displayed inline and subject to real-time policy evaluation.
                </p>
              </div>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] p-4 rounded-xl ${msg.role === "user" ? "bg-primary text-primary-foreground shadow-sm" : "bg-card border shadow-sm"}`}>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Inline SSE Tool Calls & Approvals */}
          {events.map((evt, idx) => {
            if (evt.type === "thinking") {
              // Only show if it's the last event
              if (idx !== events.length - 1) return null;
              return (
                <div key={idx} className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                  <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )
            }
            if (evt.type === "tool_call_intent") {
              // See if there's a corresponding result/blocked/requested event for this tool call intent
              // to determine its final status visually. We can look ahead in the events array.
              // For simplicity, we just show the intent if it hasn't resolved yet.
              const isResolved = events.slice(idx + 1).some(e => 
                (e.type === "tool_call_result" || e.type === "tool_call_blocked" || e.type === "approval_requested") && 
                e.data?.toolName === evt.data.toolName
              );

              if (isResolved) return null; // We'll show the resolved state card instead

              return (
                <Card key={idx} className="p-4 max-w-[85%] bg-card border-dashed">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench className="h-4 w-4 text-muted-foreground animate-pulse" />
                    <span className="font-mono text-xs font-semibold">Executing: {evt.data.toolName}</span>
                  </div>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto text-muted-foreground">
                    {JSON.stringify(evt.data.arguments, null, 2)}
                  </pre>
                </Card>
              )
            }
            if (evt.type === "tool_call_result") {
              return (
                <Card key={idx} className="p-4 max-w-[85%] border-green-500/30 bg-green-500/5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="font-mono text-xs font-bold text-green-600 dark:text-green-400">ALLOWED: {evt.data.toolName}</span>
                    </div>
                  </div>
                  <pre className="text-xs bg-background/50 p-2 rounded mt-2 overflow-x-auto border border-green-500/10">
                    {typeof evt.data.result === 'string' ? evt.data.result : JSON.stringify(evt.data.result, null, 2)}
                  </pre>
                </Card>
              )
            }
            if (evt.type === "tool_call_blocked") {
              return (
                <Card key={idx} className="p-4 max-w-[85%] border-red-500/30 bg-red-500/5 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="font-mono text-xs font-bold text-red-600 dark:text-red-400">BLOCKED: {evt.data.toolName}</span>
                  </div>
                  <p className="text-xs text-red-600/80 dark:text-red-400/80 font-medium">Reason: {evt.data.reason}</p>
                </Card>
              )
            }
            if (evt.type === "approval_requested") {
              // Check if a decision was made for this approvalId
              const decisionEvent = events.slice(idx + 1).find(e => e.type === "approval_decided" && e.data?.approvalId === evt.data.approvalId);
              
              return (
                <Card key={idx} className={`p-4 max-w-[85%] shadow-sm transition-colors ${decisionEvent ? (decisionEvent.data.decision === 'APPROVED' ? 'border-green-500/30 bg-green-500/5' : 'border-red-500/30 bg-red-500/5') : 'border-orange-500/40 bg-orange-500/10 shadow-orange-500/10'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldAlert className={`h-4 w-4 ${decisionEvent ? (decisionEvent.data.decision === 'APPROVED' ? 'text-green-500' : 'text-red-500') : 'text-orange-500 animate-pulse'}`} />
                    <span className={`font-mono text-xs font-bold ${decisionEvent ? (decisionEvent.data.decision === 'APPROVED' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400') : 'text-orange-600 dark:text-orange-400'}`}>
                      {decisionEvent ? `DECISION: ${decisionEvent.data.decision}` : `ACTION REQUIRED: ${evt.data.toolName}`}
                    </span>
                  </div>
                  
                  {!decisionEvent && (
                    <div className="text-xs mb-3 text-muted-foreground">
                      The agent wants to execute this tool. Policy requires your approval.
                    </div>
                  )}

                  <pre className="text-xs bg-background/50 p-2 rounded mb-3 overflow-x-auto border border-foreground/5">
                    {JSON.stringify(evt.data.arguments, null, 2)}
                  </pre>
                  
                  {!decisionEvent && (
                    <div className="flex items-center gap-2 mt-2">
                      <Button 
                        size="sm" 
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleApproval(evt.data.approvalId, "APPROVED")}
                      >
                        Approve
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        className="w-full"
                        onClick={() => handleApproval(evt.data.approvalId, "DENIED")}
                      >
                        Deny
                      </Button>
                    </div>
                  )}
                </Card>
              )
            }
            if (evt.type === "assistant_message") {
              return (
                <div key={idx} className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                  <div className="max-w-[85%] p-4 rounded-xl bg-card border shadow-sm">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{evt.data.content}</p>
                  </div>
                </div>
              )
            }
            return null
          })}
          
          <div ref={messagesEndRef} className="h-4" />
        </div>
      </ScrollArea>
      
      {/* Input Area */}
      <div className="p-4 bg-background border-t">
        <div className="max-w-3xl mx-auto relative flex items-center">
          <Input 
            placeholder="Ask Gatekeeper to manage secrets..." 
            className="pr-12 h-12 rounded-xl border-muted-foreground/20 shadow-sm bg-muted/30 focus-visible:ring-primary/50 text-base"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            disabled={isLoading}
          />
          <Button 
            size="icon"
            className="absolute right-1 h-10 w-10 rounded-lg shadow-none hover:scale-105 transition-transform" 
            onClick={handleSend} 
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
          </Button>
        </div>
        <div className="max-w-3xl mx-auto text-center mt-2">
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold opacity-50">Secure Enclave Active</span>
        </div>
      </div>
    </div>
  )
}
