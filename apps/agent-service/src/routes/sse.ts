/**
 * SSE Routes — Server-Sent Events for real-time dashboard updates.
 *
 * Three streams:
 *   GET /stream/agent/:conversationId  — per-conversation tool/approval events
 *   GET /stream/policies               — policy CRUD change events
 *   GET /stream/approvals              — global approval requested/decided events
 *
 * All streams:
 *   - Send a "connected" ping on open
 *   - Send a heartbeat every 30s to prevent proxy/client timeouts
 *   - Clean up EventBus listeners on client disconnect
 */

import type { FastifyInstance } from "fastify"
import type { SSEEvent, SSEEventType } from "@repo/types"
import { eventBus } from "../events/event-bus.js"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000

/**
 * Write a named SSE event or a bare "data:" comment heartbeat.
 * Using ": heartbeat\n\n" is the spec-compliant way to keep the connection alive
 * without triggering the client's message handler.
 */
function writeHeartbeat(raw: import("node:http").ServerResponse): void {
  try {
    raw.write(": heartbeat\n\n")
  } catch {
    // Client already disconnected — ignore
  }
}

/**
 * Write a typed SSE data frame.
 */
function writeSSE(raw: import("node:http").ServerResponse, event: SSEEvent): void {
  try {
    raw.write(`data: ${JSON.stringify(event)}\n\n`)
  } catch {
    // Client already disconnected — ignore
  }
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export default async function sseRoutes(fastify: FastifyInstance) {
  // ── Per-conversation agent stream ────────────────────────────────────────
  fastify.get<{ Params: { conversationId: string } }>(
    "/stream/agent/:conversationId",
    async (req, reply) => {
      const { conversationId } = req.params

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no", // Disable Nginx buffering
        "Access-Control-Allow-Origin": req.headers.origin || "*",
        "Access-Control-Allow-Credentials": "true",
      })

      // Initial connection event
      reply.raw.write(
        `data: ${JSON.stringify({ type: "connected", conversationId, timestamp: new Date().toISOString() })}\n\n`
      )

      const agentEvents: SSEEventType[] = [
        "thinking",
        "assistant_message",
        "tool_call_intent",
        "tool_call_result",
        "tool_call_blocked",
        "approval_requested",
        "approval_decided",
        "error",
      ]

      const handler = (event: SSEEvent) => {
        // Per-conversation filter: only forward events belonging to this conversation
        if (event.conversationId === conversationId) {
          writeSSE(reply.raw, event)
        }
      }

      agentEvents.forEach((e) => eventBus.on(e, handler))

      // Heartbeat
      const heartbeat = setInterval(() => writeHeartbeat(reply.raw), HEARTBEAT_INTERVAL_MS)

      req.raw.on("close", () => {
        clearInterval(heartbeat)
        agentEvents.forEach((e) => eventBus.off(e, handler))
        req.log.debug({ conversationId }, "SSE agent stream closed")
      })
    }
  )

  // ── Global policies stream ────────────────────────────────────────────────
  fastify.get("/stream/policies", async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Credentials": "true",
    })

    reply.raw.write(
      `data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`
    )

    const handler = (event: SSEEvent) => {
      writeSSE(reply.raw, event)
    }

    eventBus.on("policy_changed", handler)

    const heartbeat = setInterval(() => writeHeartbeat(reply.raw), HEARTBEAT_INTERVAL_MS)

    req.raw.on("close", () => {
      clearInterval(heartbeat)
      eventBus.off("policy_changed", handler)
      req.log.debug("SSE policies stream closed")
    })
  })

  // ── Global approvals stream ───────────────────────────────────────────────
  fastify.get("/stream/approvals", async (req, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Credentials": "true",
    })

    reply.raw.write(
      `data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`
    )

    const approvalEvents: SSEEventType[] = ["approval_requested", "approval_decided"]

    const handler = (event: SSEEvent) => {
      // Approvals stream is global — forward all approval events regardless of conversationId
      writeSSE(reply.raw, event)
    }

    approvalEvents.forEach((e) => eventBus.on(e, handler))

    const heartbeat = setInterval(() => writeHeartbeat(reply.raw), HEARTBEAT_INTERVAL_MS)

    req.raw.on("close", () => {
      clearInterval(heartbeat)
      approvalEvents.forEach((e) => eventBus.off(e, handler))
      req.log.debug("SSE approvals stream closed")
    })
  })
}
