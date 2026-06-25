/**
 * ApprovalQueue — Promise-based approval workflow with DB persistence.
 *
 * When the policy engine returns REQUIRE_APPROVAL, the agent loop calls
 * `createPending(intent, timeoutMs)` which returns a Promise that BLOCKS
 * the agent loop until an admin approves/denies or the timeout expires.
 *
 * The REST endpoint calls `resolve(approvalId, decision)` which resolves
 * the held Promise, unblocking the agent loop.
 */

import crypto from "node:crypto"
import type {
  ToolExecutionIntent,
  ApprovalDecision,
  PendingApprovalSummary,
} from "@repo/types"
import { createToolIntent, createApprovalRequest, updateApprovalRequestStatus } from "@repo/db/queries"
import { eventBus } from "../events/event-bus.js"

interface PendingEntry {
  approvalId: string
  intentId: string
  intent: ToolExecutionIntent
  createdAt: Date
  expiresAt: Date
  resolve: (decision: ApprovalDecision) => void
  timer: ReturnType<typeof setTimeout>
}

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

export class ApprovalQueue {
  private pending = new Map<string, PendingEntry>()

  /**
   * Create a pending approval. Returns a Promise that blocks until resolved.
   *
   * Called by the agent loop when policy engine returns REQUIRE_APPROVAL.
   * The Promise resolves with "APPROVED" or "DENIED".
   */
  async createPending(
    intent: ToolExecutionIntent,
    timeoutMs?: number
  ): Promise<ApprovalDecision> {
    const approvalId = crypto.randomUUID()
    const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS
    const now = new Date()
    const expiresAt = new Date(now.getTime() + timeout)

    const intentRecord = await createToolIntent({
      conversationId: intent.conversationId,
      toolName: intent.toolName,
      mcpServer: intent.mcpServer,
      arguments: intent.arguments,
      decision: "REQUIRE_APPROVAL",
    })

    const intentId = intentRecord!.id

    await createApprovalRequest({
      id: approvalId,
      intentId,
      status: "PENDING",
      expiresAt,
    })

    eventBus.emitSSE(
      "approval_requested",
      {
        approvalId,
        toolName: intent.toolName,
        serverName: intent.mcpServer,
        arguments: intent.arguments,
        expiresAt: expiresAt.toISOString(),
      },
      intent.conversationId
    )

    return new Promise<ApprovalDecision>((resolve) => {
      // Set up auto-expiry timer
      const timer = setTimeout(() => {
        this.expire(approvalId)
      }, timeout)

      this.pending.set(approvalId, {
        approvalId,
        intentId,
        intent,
        createdAt: now,
        expiresAt,
        resolve,
        timer,
      })
    })
  }

  /**
   * Resolve a pending approval (called by the REST endpoint).
   * This unblocks the agent loop's awaiting Promise and updates DB.
   */
  resolve(approvalId: string, decision: ApprovalDecision): boolean {
    const entry = this.pending.get(approvalId)
    if (!entry) return false

    clearTimeout(entry.timer)
    this.pending.delete(approvalId)
    entry.resolve(decision)

    updateApprovalRequestStatus(approvalId, decision, "admin")
      .then(() => {})
      .catch((err) => console.error("[approval-queue] DB update failed:", err))

    eventBus.emitSSE(
      "approval_decided",
      { approvalId, decision },
      entry.intent.conversationId
    )

    return true
  }

  /**
   * Auto-deny on timeout. Resolves as "DENIED" (ApprovalDecision contract)
   * but emits "EXPIRED" in the SSE so the dashboard can distinguish.
   */
  private expire(approvalId: string): void {
    const entry = this.pending.get(approvalId)
    if (!entry) return

    this.pending.delete(approvalId)
    entry.resolve("DENIED")

    updateApprovalRequestStatus(approvalId, "EXPIRED")
      .then(() => {})
      .catch((err) => console.error("[approval-queue] DB expire update failed:", err))

    eventBus.emitSSE(
      "approval_decided",
      { approvalId, decision: "EXPIRED" as const },
      entry.intent.conversationId
    )
  }

  /**
   * Get all pending approvals (for the dashboard).
   */
  getPending(): PendingApprovalSummary[] {
    const summaries: PendingApprovalSummary[] = []

    for (const [, entry] of this.pending) {
      summaries.push({
        approvalId: entry.approvalId,
        intentId: entry.intentId,
        toolName: entry.intent.toolName,
        mcpServer: entry.intent.mcpServer,
        arguments: entry.intent.arguments,
        conversationId: entry.intent.conversationId,
        expiresAt: entry.expiresAt.toISOString(),
        createdAt: entry.createdAt.toISOString(),
      })
    }

    return summaries
  }

  /**
   * Check if an approval is pending.
   */
  hasPending(approvalId: string): boolean {
    return this.pending.has(approvalId)
  }

  /**
   * Get count of pending approvals.
   */
  get pendingCount(): number {
    return this.pending.size
  }

  /**
   * Clear all pending approvals (useful for testing / graceful shutdown).
   * All in-flight Promises are resolved as DENIED.
   */
  clearAll(): void {
    for (const [approvalId, entry] of this.pending) {
      clearTimeout(entry.timer)
      entry.resolve("DENIED")
      eventBus.emitSSE(
        "approval_decided",
        { approvalId, decision: "EXPIRED" as const },
        entry.intent.conversationId
      )
    }
    this.pending.clear()
  }
}
