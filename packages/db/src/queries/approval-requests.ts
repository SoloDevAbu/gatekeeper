import db from "../index.js"
import { approvalRequests } from "../schema.js"
import { eq } from "drizzle-orm"

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
