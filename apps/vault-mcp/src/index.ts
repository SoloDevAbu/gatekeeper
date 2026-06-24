#!/usr/bin/env node

/**
 * SecureVault MCP Server
 *
 * A custom MCP server exposing 5 secret management tools:
 *   - list_secrets: List secret keys in a namespace (LOW risk)
 *   - get_secret:   Retrieve a secret value (MEDIUM risk)
 *   - set_secret:   Create or update a secret (HIGH risk)
 *   - delete_secret: Permanently delete a secret (CRITICAL risk)
 *   - rotate_secret: Generate a new random value (HIGH risk)
 *
 * Transport: stdio (JSON-RPC over stdin/stdout)
 * Storage: In-memory Map with pre-seeded dev/staging/prod namespaces
 *
 * IMPORTANT: All logging goes to stderr to avoid corrupting the
 * JSON-RPC message stream on stdout.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { VaultStore } from "./vault-store.js"
import { registerListSecrets } from "./tools/list-secrets.js"
import { registerGetSecret } from "./tools/get-secret.js"
import { registerSetSecret } from "./tools/set-secret.js"
import { registerDeleteSecret } from "./tools/delete-secret.js"
import { registerRotateSecret } from "./tools/rotate-secret.js"

// ─── Initialize ──────────────────────────────────────────────────────────────

const store = new VaultStore()

const server = new McpServer({
  name: "vault-mcp",
  version: "1.0.0",
})

// ─── Register Tools ──────────────────────────────────────────────────────────

registerListSecrets(server, store)
registerGetSecret(server, store)
registerSetSecret(server, store)
registerDeleteSecret(server, store)
registerRotateSecret(server, store)

// ─── Connect Transport ───────────────────────────────────────────────────────

async function main(): Promise<void> {
  const transport = new StdioServerTransport()
  await server.connect(transport)

  // All logging to stderr — stdout is reserved for JSON-RPC
  console.error("[vault-mcp] Server started successfully")
  console.error("[vault-mcp] Pre-seeded namespaces: dev, staging, prod")
  console.error("[vault-mcp] Registered 5 tools: list_secrets, get_secret, set_secret, delete_secret, rotate_secret")
}

main().catch((error) => {
  console.error("[vault-mcp] Fatal error:", error)
  process.exit(1)
})
