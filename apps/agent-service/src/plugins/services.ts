import fp from "fastify-plugin"
import { MCPManager } from "../mcp/manager.js"
import { loadMCPServerConfigs } from "../mcp/config-loader.js"
import { PolicyEngine } from "@repo/policy-engine"
import { ApprovalQueue } from "../approval/queue.js"
import { GeminiClient } from "../agent/gemini-client.js"
import { getAllPolicyRules } from "@repo/db/queries"
import type { AgentLoopDeps } from "../agent/loop.js"

declare module "fastify" {
  interface FastifyInstance {
    mcpManager: MCPManager
    policyEngine: PolicyEngine
    approvalQueue: ApprovalQueue
    gemini: GeminiClient
    agentDeps: AgentLoopDeps
  }
}

export default fp(async function servicesPlugin(fastify) {
  const mcpConfigs = loadMCPServerConfigs()
  const mcpManager = new MCPManager(mcpConfigs)

  fastify.log.info("[boot] Connecting to MCP servers...")
  await mcpManager.discoverAll()

  const tools = mcpManager.getDiscoveredTools()
  fastify.log.info(`[boot] ${tools.length} tool(s) available`)

  const policyEngine = new PolicyEngine()

  const dbRules = await getAllPolicyRules()
  policyEngine.reloadRules(dbRules)
  fastify.log.info(`[boot] Loaded ${dbRules.length} policy rule(s) from database`)

  const approvalQueue = new ApprovalQueue()
  const gemini = new GeminiClient()

  const agentDeps: AgentLoopDeps = { gemini, mcpManager, policyEngine, approvalQueue }

  fastify.decorate("mcpManager", mcpManager)
  fastify.decorate("policyEngine", policyEngine)
  fastify.decorate("approvalQueue", approvalQueue)
  fastify.decorate("gemini", gemini)
  fastify.decorate("agentDeps", agentDeps)

  fastify.log.info("[boot] Core services initialized")
}, { name: "services" })
