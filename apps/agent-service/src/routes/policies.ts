import crypto from "node:crypto"
import type { FastifyInstance } from "fastify"
import type { CreatePolicyRequest, UpdatePolicyRequest } from "@repo/types"
import { rules } from "../store.js"
import { eventBus } from "../events/event-bus.js"

export default async function policyRoutes(fastify: FastifyInstance) {
  fastify.get("/api/policies", async () => rules)

  fastify.post("/api/policies", async (req) => {
    const body = req.body as CreatePolicyRequest
    const rule = {
      id: crypto.randomUUID(),
      type: body.type,
      toolPattern: body.toolPattern,
      namespacePattern: body.namespacePattern ?? null,
      action: body.action,
      config: body.config ?? {},
      enabled: body.enabled ?? true,
      priority: body.priority ?? 100,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    rules.push(rule)
    fastify.policyEngine.reloadRules(rules)
    eventBus.emitSSE("policy_changed", { ruleId: rule.id, action: "created" })

    return rule
  })

  fastify.put<{ Params: { id: string } }>("/api/policies/:id", async (req, reply) => {
    const { id } = req.params
    const body = req.body as UpdatePolicyRequest

    const ruleIndex = rules.findIndex((r) => r.id === id)
    if (ruleIndex === -1) {
      const error: any = new Error("Rule not found")
      error.statusCode = 404
      throw error
    }

    const existing = rules[ruleIndex]!
    rules[ruleIndex] = {
      ...existing,
      ...body,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    } as typeof existing

    fastify.policyEngine.reloadRules(rules)
    eventBus.emitSSE("policy_changed", { ruleId: id, action: "updated" })

    return rules[ruleIndex]
  })

  fastify.delete<{ Params: { id: string } }>("/api/policies/:id", async (req, reply) => {
    const { id } = req.params
    const ruleIndex = rules.findIndex((r) => r.id === id)
    if (ruleIndex === -1) {
      const error: any = new Error("Rule not found")
      error.statusCode = 404
      throw error
    }

    rules.splice(ruleIndex, 1)
    fastify.policyEngine.reloadRules(rules)
    eventBus.emitSSE("policy_changed", { ruleId: id, action: "deleted" })

    return { success: true }
  })

  fastify.patch<{ Params: { id: string } }>("/api/policies/:id/toggle", async (req, reply) => {
    const { id } = req.params
    const body = req.body as { enabled: boolean }
    const rule = rules.find((r) => r.id === id)
    if (!rule) {
      const error: any = new Error("Rule not found")
      error.statusCode = 404
      throw error
    }

    rule.enabled = body.enabled
    rule.updatedAt = new Date().toISOString()
    fastify.policyEngine.reloadRules(rules)
    eventBus.emitSSE("policy_changed", { ruleId: id, action: "toggled" })

    return rule
  })
}
