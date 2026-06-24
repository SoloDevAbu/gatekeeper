// ─── SSE Event Types ────────────────────────────────────────────────────────
// Typed envelope for all Server-Sent Events between agent-service and dashboard.

/**
 * All SSE event types emitted by the agent service.
 */
export type SSEEventType =
  | "thinking"
  | "assistant_message"
  | "tool_call_intent"
  | "tool_call_result"
  | "tool_call_blocked"
  | "approval_requested"
  | "approval_decided"
  | "policy_changed"
  | "error"

/**
 * Typed SSE event envelope — every SSE message follows this shape.
 */
export interface SSEEvent<T = unknown> {
  type: SSEEventType
  conversationId?: string
  timestamp: string
  data: T
}

// ─── SSE Event Data Payloads ────────────────────────────────────────────────

export interface ThinkingEventData {}

export interface AssistantMessageEventData {
  content: string
}

export interface ToolCallIntentEventData {
  toolName: string
  serverName: string
  arguments: Record<string, unknown>
}

export interface ToolCallResultEventData {
  toolName: string
  serverName: string
  result: unknown
  decision: "ALLOW"
}

export interface ToolCallBlockedEventData {
  toolName: string
  serverName: string
  reason: string
  ruleId?: string
}

export interface ApprovalRequestedEventData {
  approvalId: string
  toolName: string
  serverName: string
  arguments: Record<string, unknown>
  expiresAt: string
}

export interface ApprovalDecidedEventData {
  approvalId: string
  decision: "APPROVED" | "DENIED" | "EXPIRED"
  decidedBy?: string
  reason?: string
}

export interface PolicyChangedEventData {
  ruleId: string
  action: "created" | "updated" | "deleted" | "toggled"
}

export interface ErrorEventData {
  message: string
  code?: string
}
