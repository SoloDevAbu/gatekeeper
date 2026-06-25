import db from "../index.js"
import { toolIntents } from "../schema.js"

export async function createToolIntent(data: typeof toolIntents.$inferInsert) {
  const [intent] = await db.insert(toolIntents).values(data).returning()
  return intent
}
