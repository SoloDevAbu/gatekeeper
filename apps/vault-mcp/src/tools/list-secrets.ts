import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { VaultStore } from "../vault-store.js"

/**
 * list_secrets — List all secret keys in a namespace.
 *
 * Risk level: LOW (read-only, returns keys not values)
 * Guardrail interest: Namespace restriction rules may limit which namespaces
 * the agent can list.
 */
export function registerListSecrets(
  server: McpServer,
  store: VaultStore
): void {
  server.tool(
    "list_secrets",
    "List all secret key names in a given namespace. Returns only the key names, not the secret values. Use this to discover what secrets exist before retrieving them.",
    {
      namespace: z
        .string()
        .describe(
          'The namespace to list secrets from (e.g. "dev", "staging", "prod")'
        ),
    },
    async ({ namespace }) => {
      const namespaces = await store.listNamespaces()

      if (!namespaces.includes(namespace)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Namespace "${namespace}" does not exist. Available namespaces: ${namespaces.join(", ")}`,
            },
          ],
          isError: true,
        }
      }

      const keys = await store.listKeys(namespace)

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                namespace,
                count: keys.length,
                keys,
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
