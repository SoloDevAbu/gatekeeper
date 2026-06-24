import type { FastifyInstance } from "fastify"

export default async function coreRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    mcpServers: fastify.mcpManager.getServerStatuses(),
    toolCount: fastify.mcpManager.getToolNames().length,
    pendingApprovals: fastify.approvalQueue.pendingCount,
    policyRuleCount: fastify.policyEngine.getRuleCount(),
  }))

  fastify.get("/api/servers", async () => fastify.mcpManager.getServerStatuses())
  fastify.get("/api/servers/tools", async () => fastify.mcpManager.getDiscoveredTools())
}
