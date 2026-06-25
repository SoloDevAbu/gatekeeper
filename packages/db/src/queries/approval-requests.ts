import db from "../index.js"
import { approvalRequests, toolIntents } from "../schema.js"
import { eq, and, gt, asc } from "drizzle-orm"

export async function createApprovalRequest(data: typeof approvalRequests.$inferInsert) {
  const [request] = await db.insert(approvalRequests).values(data).returning()
  return request
}

export async function updateApprovalRequestStatus(id: string, status: string, decidedBy?: string) {
  const [updated] = await db
    .update(approvalRequests)
    .set({
      status,
      ...(decidedBy ? { decidedBy } : {}),
      decidedAt: new Date(),
    })
    .where(eq(approvalRequests.id, id))
    .returning()
  return updated
}

export async function getAllApprovalRequests() {
  return db.select().from(approvalRequests)
}

/**
 * Returns all PENDING, non-expired approval requests for a given conversation.
 * Used by the frontend when a user returns to a chat to re-hydrate pending approvals.
 */
export async function getPendingApprovalsByConversation(conversationId: string) {
  return db
    .select({
      approvalId: approvalRequests.id,
      toolName: toolIntents.toolName,
      serverName: toolIntents.mcpServer,
      arguments: toolIntents.arguments,
      expiresAt: approvalRequests.expiresAt,
      createdAt: approvalRequests.createdAt,
    })
    .from(approvalRequests)
    .innerJoin(toolIntents, eq(approvalRequests.intentId, toolIntents.id))
    .where(
      and(
        eq(toolIntents.conversationId, conversationId),
        eq(approvalRequests.status, "PENDING"),
        gt(approvalRequests.expiresAt, new Date())
      )
    )
    .orderBy(asc(approvalRequests.createdAt))
}
