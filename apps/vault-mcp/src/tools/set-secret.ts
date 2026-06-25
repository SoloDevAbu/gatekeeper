import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { VaultStore } from "../vault-store.js"

/**
 * set_secret — Create or update a secret in a namespace.
 *
 * Risk level: HIGH (can overwrite existing secrets, create new ones in prod)
 * Guardrail interest:
 *   - Namespace restriction: block writes to prod
 *   - Require approval: approve before setting prod secrets
 *   - Input validation: validate key naming conventions
 */
export function registerSetSecret(
  server: McpServer,
  store: VaultStore
): void {
  server.tool(
    "set_secret",
    "Create a new secret or update an existing one in a given namespace. If the namespace doesn't exist, it will be created automatically.",
    {
      namespace: z
        .string()
        .describe(
          'The target namespace (e.g. "dev", "staging", "prod")'
        ),
      key: z
        .string()
        .describe(
          'The secret key name (e.g. "db_password", "api_key")'
        ),
      value: z
        .string()
        .describe("The secret value to store"),
    },
    async ({ namespace, key, value }) => {
      const existed = (await store.getSecret(namespace, key)) !== null
      await store.setSecret(namespace, key, value)

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                success: true,
                namespace,
                key,
                action: existed ? "updated" : "created",
                message: existed
                  ? `Secret "${key}" in namespace "${namespace}" has been updated.`
                  : `Secret "${key}" has been created in namespace "${namespace}".`,
              },
              null,
              2
            ),
          },
        ],
      }
    }
  )
}
