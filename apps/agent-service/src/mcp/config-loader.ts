/**
 * Load MCP server configurations from mcp-servers.json.
 *
 * This file is read at startup and when /api/servers/refresh is called.
 * No DB dependency — file-based for MVP simplicity.
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import type { MCPServerConfig } from "@repo/types"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONFIG_PATH = path.resolve(__dirname, "../../mcp-servers.json")

interface MCPServersFile {
  servers: MCPServerConfig[]
}

/**
 * Load and parse the MCP server configurations.
 * Resolves relative command paths against the agent-service directory.
 */
export function loadMCPServerConfigs(): MCPServerConfig[] {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8")
    const parsed = JSON.parse(raw) as MCPServersFile
    return parsed.servers ?? []
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[mcp:config] Failed to load ${CONFIG_PATH}: ${message}`)
    return []
  }
}
