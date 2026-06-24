// ─── Approval Types ─────────────────────────────────────────────────────────
// Types for the Promise-based approval queue workflow.

import type { ToolExecutionIntent } from "./policy"

/**
 * Possible outcomes when an approval is resolved.
 */
export type ApprovalDecision = "APPROVED" | "DENIED"

/**
 * Possible statuses for an approval request in the DB.
 */
export type ApprovalStatus = "PENDING" | "APPROVED" | "DENIED" | "EXPIRED"

/**
 * An in-memory pending approval entry held by the ApprovalQueue.
 * Contains the Promise resolve function that unblocks the agent loop.
 */
export interface PendingApproval {
  approvalId: string
  intentId: string
  intent: ToolExecutionIntent
  expiresAt: Date
  /** Resolve function — calling this unblocks the awaiting agent loop */
  resolve: (decision: ApprovalDecision) => void
  /** Timeout handle for auto-expiration */
  timer: ReturnType<typeof setTimeout>
}

/**
 * Request body for POST /api/approvals/:id/decide
 */
export interface ApprovalDecisionRequest {
  decision: ApprovalDecision
  reason?: string
  decidedBy?: string
}

/**
 * Summary of a pending approval shown in the dashboard.
 */
export interface PendingApprovalSummary {
  approvalId: string
  intentId: string
  toolName: string
  mcpServer: string
  arguments: Record<string, unknown>
  conversationId: string
  expiresAt: string
  createdAt: string
}
