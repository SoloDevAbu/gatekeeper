import crypto from "node:crypto"
import type { FastifyInstance } from "fastify"
import type { ChatRequest } from "@repo/types"
import {
  getConversationLogs,
  insertConversationLogs,
  getConversationSummaries,
} from "@repo/db/queries"
import type { Content } from "@google/genai"
import { runAgentLoop } from "../agent/loop.js"

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.post("/api/chat", async (req, reply) => {
    const body = req.body as ChatRequest

    if (!body || !body.message || typeof body.message !== "string") {
      const error: any = new Error("message is required")
      error.statusCode = 400
      throw error
    }

    const conversationId = body.conversationId ?? crypto.randomUUID()

    const dbLogs = await getConversationLogs(conversationId)

    const history: Content[] = dbLogs.map((log) => ({
      role: log.role === "user" ? "user" : "model",
      parts: [{ text: log.content }],
    }))

    const result = await runAgentLoop(body.message, conversationId, history, fastify.agentDeps)

    await insertConversationLogs([
      {
        conversationId,
        role: "user",
        content: body.message,
        metadata: {},
      },
      {
        conversationId,
        role: "assistant",
        content: result.response,
        metadata: { tokenCount: result.tokenCount },
      },
    ])

    fastify.policyEngine.trackTokenUsage(conversationId, result.tokenCount)

    return {
      conversationId: result.conversationId,
      response: result.response,
    }
  })

  fastify.get("/api/conversations", async () => {
    return getConversationSummaries()
  })

  fastify.get<{ Params: { id: string } }>("/api/conversations/:id", async (req) => {
    const { id } = req.params

    return getConversationLogs(id)
  })
}
