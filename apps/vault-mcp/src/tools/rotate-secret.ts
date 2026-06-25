import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { VaultStore } from "../vault-store.js"

/**
 * rotate_secret — Generate a new cryptographically random value for an existing secret.
 *
 * Risk level: HIGH (modifies production secrets — could break downstream services)
 * Guardrail interest:
 *   - Require approval: approve before rotating prod secrets
 *   - Namespace restriction: block prod rotations
 */
export function registerRotateSecret(
  server: McpServer,
  store: VaultStore
): void {
  server.tool(
    "rotate_secret",
    "Generate a new cryptographically random value for an existing secret. The old value is permanently replaced. Use this for periodic credential rotation.",
    {
      namespace: z
        .string()
        .describe(
          'The namespace containing the secret (e.g. "dev", "staging", "prod")'
        ),
      key: z
        .string()
        .describe("The secret key to rotate"),
      length: z
        .number()
        .int()
        .min(8)
        .max(128)
        .optional()
        .default(32)
        .describe(
          "Length of the new random value in characters (default: 32, min: 8, max: 128)"
        ),
    },
    async ({ namespace, key, length }) => {
      try {
        const newValue = await store.rotateSecret(namespace, key, length)

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  success: true,
                  namespace,
                  key,
                  action: "rotated",
                  newValue,
                  length: newValue.length,
                  message: `Secret "${key}" in namespace "${namespace}" has been rotated. The old value is permanently replaced.`,
                  warning:
                    "Any services using the old value will need to be updated.",
                },
                null,
                2
              ),
            },
          ],
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error"

        return {
          content: [
            {
              type: "text" as const,
              text: message,
            },
          ],
          isError: true,
        }
      }
    }
  )
}
