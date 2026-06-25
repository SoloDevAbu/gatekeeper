import db from "../index.js"
import { conversationLogs } from "../schema.js"
import { eq, asc } from "drizzle-orm"

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
