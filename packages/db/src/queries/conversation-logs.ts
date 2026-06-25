import db from "../index.js"
import { conversationLogs } from "../schema.js"
import { eq, asc, desc, sql } from "drizzle-orm"

export async function getConversationLogs(conversationId: string) {
  return db
    .select()
    .from(conversationLogs)
    .where(eq(conversationLogs.conversationId, conversationId))
    .orderBy(asc(conversationLogs.createdAt))
}

export async function insertConversationLogs(data: (typeof conversationLogs.$inferInsert)[]) {
  await db.insert(conversationLogs).values(data)
}

export async function getDistinctConversationIds() {
  const rows = await db
    .selectDistinct({ conversationId: conversationLogs.conversationId })
    .from(conversationLogs)
  return rows.map((r) => r.conversationId)
}

/**
 * Returns a summary of each conversation for the sidebar:
 * - conversationId
 * - preview: first user message (truncated to 80 chars)
 * - updatedAt: timestamp of the most recent message
 * Ordered newest-first.
 */
export async function getConversationSummaries(): Promise<
  { conversationId: string; preview: string; updatedAt: string }[]
> {
  const rows = await db
    .select({
      conversationId: conversationLogs.conversationId,
      // Correlated sub-select: first user message in this conversation
      preview: sql<string>`(
        SELECT content FROM conversation_logs cl2
        WHERE cl2.conversation_id = ${conversationLogs.conversationId}
          AND cl2.role = 'user'
        ORDER BY cl2.created_at ASC
        LIMIT 1
      )`,
      updatedAt: sql<string>`MAX(${conversationLogs.createdAt})`,
    })
    .from(conversationLogs)
    .groupBy(conversationLogs.conversationId)
    .orderBy(desc(sql`MAX(${conversationLogs.createdAt})`))

  return rows.map((r) => ({
    conversationId: r.conversationId,
    preview: r.preview
      ? r.preview.length > 80
        ? r.preview.slice(0, 80) + "\u2026"
        : r.preview
      : "New conversation",
    updatedAt: r.updatedAt,
  }))
}
