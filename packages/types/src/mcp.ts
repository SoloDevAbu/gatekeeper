// ─── MCP Types ──────────────────────────────────────────────────────────────
// Types for MCP server configuration, connection management, and tool discovery.

/**
 * Configuration for a single MCP server.
 * Loaded from mcp-servers.json at agent-service startup.
 */
export interface MCPServerConfig {
  /** Unique identifier for this server (e.g. "vault-mcp", "context7") */
  name: string
  /** The command to spawn the server process (e.g. "node", "npx") */
  command: string
  /** Arguments to pass to the command (e.g. ["dist/index.js"]) */
  args: string[]
  /** Optional environment variables for the spawned process */
  env?: Record<string, string>
}

/**
 * Runtime health status of a connected MCP server.
 * Returned by GET /api/servers.
 */
export interface MCPServerStatus {
  name: string
  status: "connected" | "disconnected" | "reconnecting"
  /** List of tool names discovered from this server */
  tools: string[]
  /** When the server was last successfully connected */
  lastConnected?: string
  /** Error message if disconnected */
  error?: string
}

/**
 * A tool discovered from an MCP server — used in the tool registry.
 * This is a simplified view of the MCP protocol's Tool type.
 */
export interface DiscoveredTool {
  /** Tool name (may be prefixed if collision detected) */
  registeredName: string
  /** Original tool name as reported by the MCP server */
  originalName: string
  /** Human-readable description */
  description: string
  /** JSON Schema for the tool's input parameters */
  inputSchema: Record<string, unknown>
  /** Which MCP server owns this tool */
  serverName: string
}
