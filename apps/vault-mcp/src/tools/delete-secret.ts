import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { VaultStore } from "../vault-store.js"

/**
 * delete_secret — Permanently delete a secret from a namespace.
 *
 * Risk level: CRITICAL (destructive, irreversible)
 * Guardrail interest:
 *   - Tool block: "never allow delete_secret" — the primary demo scenario
 *   - Require approval: approve before deleting any secret
 *   - Namespace restriction: absolutely block prod deletions
 */
export function registerDeleteSecret(
  server: McpServer,
  store: VaultStore
): void {
  server.tool(
    "delete_secret",
    "Permanently delete a secret from a namespace. This action is IRREVERSIBLE. The secret will be immediately removed and cannot be recovered.",
    {
      namespace: z
        .string()
        .describe(
          'The namespace containing the secret (e.g. "dev", "staging", "prod")'
        ),
      key: z
        .string()
        .describe("The secret key to permanently delete"),
    },
    async ({ namespace, key }) => {
      const deleted = await store.deleteSecret(namespace, key)

      if (!deleted) {
        const keys = await store.listKeys(namespace)
        const suggestion =
          keys.length > 0
            ? `Available keys in "${namespace}": ${keys.join(", ")}`
            : `Namespace "${namespace}" does not exist or has no secrets.`

        return {
          content: [
            {
              type: "text" as const,
              text: `Secret "${key}" not found in namespace "${namespace}". Nothing was deleted. ${suggestion}`,
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
                success: true,
                namespace,
                key,
                action: "deleted",
                message: `Secret "${key}" has been permanently deleted from namespace "${namespace}".`,
                warning: "This action is irreversible.",
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
