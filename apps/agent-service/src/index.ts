/**
 * Gatekeeper Agent Service — Entry Point
 */
import { config as envConfig, validateConfig } from "./config.js"
import { buildApp } from "./app.js"
import { eventBus } from "./events/event-bus.js"

async function main() {
  validateConfig()

  const app = await buildApp()

  // Graceful Shutdown
  const closeListeners = ["SIGINT", "SIGTERM"]
  closeListeners.forEach((signal) => {
    process.on(signal, async () => {
      app.log.info(`[shutdown] Received ${signal}, shutting down gracefully...`)
      // Deny all in-flight approval Promises so agent loops unblock cleanly
      app.approvalQueue.clearAll()
      await app.mcpManager.disconnectAll()
      await app.close()
      process.exit(0)
    })
  })


  eventBus.on("policy_changed", () => {
    app.log.info("[policy] Rules reloaded in policy engine")
  })

  try {
    await app.listen({ port: envConfig.port, host: envConfig.host })
    app.log.info(`Agent service running at http://${envConfig.host}:${envConfig.port}`)
  } catch (err) {
    app.log.fatal({ err }, "Failed to start server")
    process.exit(1)
  }
}

main().catch((error) => {
  console.error("[boot] Fatal error:", error)
  process.exit(1)
})
