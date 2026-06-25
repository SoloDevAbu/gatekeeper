import type { FastifyInstance } from "fastify"
import type { CreatePolicyRequest, UpdatePolicyRequest } from "@repo/types"
import {
  getAllPolicyRules,
  createPolicyRule,
  getPolicyRuleById,
  updatePolicyRule,
  deletePolicyRule,
  togglePolicyRule,
} from "@repo/db/queries"
import { eventBus } from "../events/event-bus.js"

export default async function policyRoutes(fastify: FastifyInstance) {
  fastify.get("/api/policies", async () => {
    return getAllPolicyRules()
  })

  fastify.post("/api/policies", async (req) => {
    const body = req.body as CreatePolicyRequest

    const rule = await createPolicyRule({
      type: body.type,
      toolPattern: body.toolPattern,
      namespacePattern: body.namespacePattern ?? null,
      action: body.action,
      config: body.config ?? {},
      enabled: body.enabled ?? true,
      priority: body.priority ?? 100,
    })

    const allRules = await getAllPolicyRules()
    fastify.policyEngine.reloadRules(allRules)

    eventBus.emitSSE("policy_changed", { ruleId: rule!.id, action: "created" })

    return rule
  })

  fastify.put<{ Params: { id: string } }>("/api/policies/:id", async (req, reply) => {
    const { id } = req.params
    const body = req.body as UpdatePolicyRequest

    // Check existence
    const existing = await getPolicyRuleById(id)

    if (!existing) {
      const error: any = new Error("Rule not found")
      error.statusCode = 404
      throw error
    }

    const updated = await updatePolicyRule(id, {
      ...(body.type !== undefined && { type: body.type }),
      ...(body.toolPattern !== undefined && { toolPattern: body.toolPattern }),
      ...(body.namespacePattern !== undefined && { namespacePattern: body.namespacePattern }),
      ...(body.action !== undefined && { action: body.action }),
      ...(body.config !== undefined && { config: body.config }),
      ...(body.enabled !== undefined && { enabled: body.enabled }),
      ...(body.priority !== undefined && { priority: body.priority }),
    })

    const allRules = await getAllPolicyRules()
    fastify.policyEngine.reloadRules(allRules)

    eventBus.emitSSE("policy_changed", { ruleId: id, action: "updated" })

    return updated
  })

  fastify.delete<{ Params: { id: string } }>("/api/policies/:id", async (req, reply) => {
    const { id } = req.params

    const result = await deletePolicyRule(id)

    if (result.length === 0) {
      const error: any = new Error("Rule not found")
      error.statusCode = 404
      throw error
    }

    const allRules = await getAllPolicyRules()
    fastify.policyEngine.reloadRules(allRules)

    eventBus.emitSSE("policy_changed", { ruleId: id, action: "deleted" })

    return { success: true }
  })

  fastify.patch<{ Params: { id: string } }>("/api/policies/:id/toggle", async (req, reply) => {
    const { id } = req.params
    const body = req.body as { enabled: boolean }

    const updated = await togglePolicyRule(id, body.enabled)

    if (!updated) {
      const error: any = new Error("Rule not found")
      error.statusCode = 404
      throw error
    }

    const allRules = await getAllPolicyRules()
    fastify.policyEngine.reloadRules(allRules)

    eventBus.emitSSE("policy_changed", { ruleId: id, action: "toggled" })

    return updated
  })
}
