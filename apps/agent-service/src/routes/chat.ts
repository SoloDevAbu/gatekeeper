import crypto from "node:crypto"
import type { FastifyInstance } from "fastify"
import type { ChatRequest } from "@repo/types"
import { conversations } from "../store.js"
import { runAgentLoop } from "../agent/loop.js"
import { GeminiClient } from "../agent/gemini-client.js"

export default async function chatRoutes(fastify: FastifyInstance) {
  fastify.post("/api/chat", async (req, reply) => {
    const body = req.body as ChatRequest

    if (!body || !body.message || typeof body.message !== "string") {
      const error: any = new Error("message is required")
      error.statusCode = 400
      throw error
    }

    const conversationId = body.conversationId ?? crypto.randomUUID()
    const history = conversations.get(conversationId) ?? []

    const result = await runAgentLoop(body.message, conversationId, history, fastify.agentDeps)

    history.push(GeminiClient.userMessage(body.message))
    history.push({ role: "model", parts: [{ text: result.response }] })
    conversations.set(conversationId, history)

    fastify.policyEngine.trackTokenUsage(conversationId, result.tokenCount)

    return {
      conversationId: result.conversationId,
      response: result.response,
    }
  })
}
