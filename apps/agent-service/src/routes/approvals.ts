import type { FastifyInstance } from "fastify"
import type { ApprovalDecisionRequest } from "@repo/types"
import {
  updateApprovalRequestStatus,
  getAllApprovalRequests,
  getPendingApprovalsByConversation,
} from "@repo/db/queries"

export default async function approvalRoutes(fastify: FastifyInstance) {
  fastify.get("/api/approvals", async () => {
    return fastify.approvalQueue.getPending()
  })

  fastify.get("/api/approvals/history", async () => {
    return getAllApprovalRequests()
  })

  /** Pending approvals for a specific conversation — used for re-hydration when user returns to a chat. */
  fastify.get<{ Params: { conversationId: string } }>(
    "/api/approvals/pending/:conversationId",
    async (req) => {
      const { conversationId } = req.params
      return getPendingApprovalsByConversation(conversationId)
    }
  )

  fastify.post<{ Params: { id: string } }>("/api/approvals/:id/decide", async (req, reply) => {
    const { id } = req.params
    const body = req.body as ApprovalDecisionRequest

    if (!body.decision || !["APPROVED", "DENIED"].includes(body.decision)) {
      const error: any = new Error("decision must be 'APPROVED' or 'DENIED'")
      error.statusCode = 400
      throw error
    }

    const resolved = fastify.approvalQueue.resolve(id, body.decision)

    if (!resolved) {
      const error: any = new Error("Approval not found or already resolved")
      error.statusCode = 404
      throw error
    }

    await updateApprovalRequestStatus(id, body.decision, "admin")

    return { success: true, approvalId: id, decision: body.decision }
  })
}
