import fp from "fastify-plugin"
import type { FastifyError, FastifyRequest, FastifyReply } from "fastify"

export default fp(async function errorHandlerPlugin(fastify) {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    request.log.error({ err: error }, "Request error")

    if (error.validation) {
      return reply.code(400).send({
        statusCode: 400,
        error: "Bad Request",
        message: "Validation failed",
        details: error.validation,
      })
    }

    const statusCode = error.statusCode ?? 500
    const code = error.code ?? "INTERNAL_ERROR"
    const message =
      statusCode >= 500 && process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : error.message

    return reply.code(statusCode).send({
      statusCode,
      error: code,
      message,
    })
  })
}, { name: "error-handler" })
