import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { VaultStore } from "../vault-store.js"

/**
 * get_secret — Retrieve the value of a specific secret.
 *
 * Risk level: MEDIUM (exposes actual secret values — could leak prod credentials)
 * Guardrail interest:
 *   - Namespace restriction: block access to prod secrets
 *   - Require approval: approve before reading sensitive keys
 */
export function registerGetSecret(
  server: McpServer,
  store: VaultStore
): void {
  server.tool(
    "get_secret",
    "Retrieve the actual value of a specific secret by namespace and key. WARNING: This returns the raw secret value. Handle with care.",
    {
      namespace: z
        .string()
        .describe(
          'The namespace containing the secret (e.g. "dev", "staging", "prod")'
        ),
      key: z
        .string()
        .describe(
          'The secret key name to retrieve (e.g. "db_password", "api_key")'
        ),
    },
    async ({ namespace, key }) => {
      const value = await store.getSecret(namespace, key)

      if (value === null) {
        const keys = await store.listKeys(namespace)
        const suggestion =
          keys.length > 0
            ? `Available keys in "${namespace}": ${keys.join(", ")}`
            : `Namespace "${namespace}" does not exist or has no secrets.`

        return {
          content: [
            {
              type: "text" as const,
              text: `Secret "${key}" not found in namespace "${namespace}". ${suggestion}`,
            },
          ],
          isError: true,
        }
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                namespace,
                key,
                value,
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
