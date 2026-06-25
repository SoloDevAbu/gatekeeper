import Fastify from "fastify"
import cors from "@fastify/cors"
import { config as envConfig } from "./config.js"

// Plugins
import servicesPlugin from "./plugins/services.js"
import errorHandlerPlugin from "./plugins/error-handler.js"

// Routes
import coreRoutes from "./routes/core.js"
import chatRoutes from "./routes/chat.js"
import approvalRoutes from "./routes/approvals.js"
import policyRoutes from "./routes/policies.js"
import sseRoutes from "./routes/sse.js"

function getLoggerConfig() {
  if (process.env.NODE_ENV === "production") {
    return { level: "info" }
  }
  if (process.env.NODE_ENV === "test") {
    return false
  }
  return true
}

export async function buildApp() {
  const app = Fastify({
    logger: getLoggerConfig(),
    disableRequestLogging: process.env.NODE_ENV !== "development",
    pluginTimeout: 120000, // Increased to allow npx to download MCP servers
  })

  // Register Core Plugins
  await app.register(errorHandlerPlugin)
  await app.register(servicesPlugin)

  await app.register(cors, {
    origin: [envConfig.frontendUrl, "http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })

  // Custom Request Logging
  if (process.env.NODE_ENV !== "development") {
    app.addHook("onRequest", async (request) => {
      request.log.info({ method: request.method, url: request.url }, "Request received")
    })
    app.addHook("onResponse", async (request, reply) => {
      request.log.info(
        { statusCode: reply.statusCode, responseTime: reply.elapsedTime },
        "Request completed"
      )
    })
  }

  // Register Routes
  await app.register(coreRoutes)
  await app.register(chatRoutes)
  await app.register(approvalRoutes)
  await app.register(policyRoutes)
  await app.register(sseRoutes)

  return app
}
