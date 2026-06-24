/**
 * MCPManager — Manages connections to multiple MCP servers.
 *
 * Key responsibilities:
 * 1. Connect to MCP servers via stdio transport (spawns child processes)
 * 2. Discover tools at runtime via listTools() — NO hardcoded tool lists
 * 3. Build an auto-routing registry: Map<toolName, { client, serverName, tool }>
 * 4. Handle tool name collisions by prefixing with server name
 * 5. Convert discovered tools to Gemini FunctionDeclarations
 * 6. Route executeTool() calls to the correct server automatically
 * 7. Handle server crashes with reconnection
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import type { MCPServerConfig, MCPServerStatus, DiscoveredTool } from "@repo/types"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Internal registry entry — maps a tool name to its MCP client and metadata */
interface ToolRegistryEntry {
  client: Client
  serverName: string
  originalToolName: string
  description: string
  inputSchema: Record<string, unknown>
}

/** Internal connection state for a single MCP server */
interface MCPConnection {
  client: Client
  transport: StdioClientTransport
  config: MCPServerConfig
  status: "connected" | "disconnected" | "reconnecting"
  tools: string[]
  lastConnected?: Date
  error?: string
  reconnectAttempts: number
}

/** Gemini FunctionDeclaration shape */
export interface GeminiFunctionDeclaration {
  name: string
  description: string
  parameters?: Record<string, unknown>
}

const MAX_RECONNECT_ATTEMPTS = 3
const RECONNECT_BASE_DELAY_MS = 2000

export class MCPManager {
  /** Auto-routing registry: toolName → { client, serverName, schema } */
  private registry = new Map<string, ToolRegistryEntry>()

  /** Active connections by server name */
  private connections = new Map<string, MCPConnection>()

  /** Server configs loaded from mcp-servers.json */
  private configs: MCPServerConfig[]

  constructor(configs: MCPServerConfig[]) {
    this.configs = configs
  }

  /**
   * Connect to all configured MCP servers in parallel and discover their tools.
   * Called once at startup and on /api/servers/refresh.
   */
  async discoverAll(): Promise<void> {
    console.log(`[mcp] Discovering tools from ${this.configs.length} server(s)...`)

    const results = await Promise.allSettled(
      this.configs.map((config) => this.connectServer(config))
    )

    for (let i = 0; i < results.length; i++) {
      const result = results[i]!
      const config = this.configs[i]!
      if (result.status === "fulfilled") {
        console.log(`[mcp] ${config.name}: connected`)
      } else {
        console.error(`[mcp] ${config.name}: ${result.reason}`)
      }
    }

    console.log(`[mcp] Registry: ${this.registry.size} tool(s) discovered across ${this.connections.size} server(s)`)
  }

  /**
   * Connect to a single MCP server, discover its tools, register them.
   */
  private async connectServer(config: MCPServerConfig): Promise<void> {
    const resolvedArgs = config.args.map((arg) => {
      if (arg.startsWith("../") || arg.startsWith("./")) {
        return path.resolve(__dirname, "../../", arg)
      }
      return arg
    })

    const transport = new StdioClientTransport({
      command: config.command,
      args: resolvedArgs,
      env: { ...process.env, ...config.env } as Record<string, string>,
    })

    const client = new Client(
      { name: "gatekeeper-agent", version: "1.0.0" },
      { capabilities: {} }
    )

    await client.connect(transport)

    const { tools } = await client.listTools()

    const toolNames: string[] = []

    // Register each tool with collision detection
    for (const tool of tools) {
      let registeredName = tool.name

      if (this.registry.has(tool.name)) {
        const existing = this.registry.get(tool.name)!
        if (existing.serverName !== config.name) {
          registeredName = `${config.name}__${tool.name}`
          console.warn(
            `[mcp] Tool name collision: "${tool.name}" exists on "${existing.serverName}". ` +
            `Registered as "${registeredName}" for "${config.name}".`
          )
        }
      }

      this.registry.set(registeredName, {
        client,
        serverName: config.name,
        originalToolName: tool.name,
        description: tool.description ?? "",
        inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
      })

      toolNames.push(registeredName)
    }

    // Store connection state
    const connection: MCPConnection = {
      client,
      transport,
      config,
      status: "connected",
      tools: toolNames,
      lastConnected: new Date(),
      reconnectAttempts: 0,
    }

    this.connections.set(config.name, connection)

    // Listen for crashes
    transport.onclose = () => {
      this.handleDisconnect(config.name)
    }

    console.log(
      `[mcp] ${config.name}: discovered ${tools.length} tool(s) → [${toolNames.join(", ")}]`
    )
  }

  /**
   * Execute a tool by name — auto-routes to the correct MCP server.
   * The agent loop only needs to pass the tool name from Gemini's function call.
   */
  async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ content: unknown; isError?: boolean }> {
    const entry = this.registry.get(toolName)
    if (!entry) {
      throw new Error(`Unknown tool: "${toolName}". Available tools: ${this.getToolNames().join(", ")}`)
    }

    // Check if server is connected
    const conn = this.connections.get(entry.serverName)
    if (!conn || conn.status !== "connected") {
      throw new Error(
        `Tool "${toolName}" is unavailable: MCP server "${entry.serverName}" is ${conn?.status ?? "disconnected"}.`
      )
    }

    try {
      const result = await entry.client.callTool({
        name: entry.originalToolName,
        arguments: args,
      })

      return {
        content: result.content,
        isError: result.isError === true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Tool execution failed for "${toolName}" on "${entry.serverName}": ${message}`
      )
    }
  }

  /**
   * Convert all discovered tools to Gemini FunctionDeclaration format.
   * Called before every Gemini API call to inject available tools.
   */
  getGeminiFunctionDeclarations(): GeminiFunctionDeclaration[] {
    const declarations: GeminiFunctionDeclaration[] = []

    for (const [registeredName, entry] of this.registry) {
      const declaration: GeminiFunctionDeclaration = {
        name: registeredName,
        description: entry.description,
      }

      if (
        entry.inputSchema &&
        typeof entry.inputSchema === "object" &&
        Object.keys(entry.inputSchema).length > 0
      ) {
        declaration.parameters = entry.inputSchema
      }

      declarations.push(declaration)
    }

    return declarations
  }

  /** Get all registered tool names */
  getToolNames(): string[] {
    return Array.from(this.registry.keys())
  }

  /** Get all discovered tools with full metadata */
  getDiscoveredTools(): DiscoveredTool[] {
    const tools: DiscoveredTool[] = []
    for (const [registeredName, entry] of this.registry) {
      tools.push({
        registeredName,
        originalName: entry.originalToolName,
        description: entry.description,
        inputSchema: entry.inputSchema,
        serverName: entry.serverName,
      })
    }
    return tools
  }

  /** Find which server owns a tool (used by the agent loop for logging) */
  getServerForTool(toolName: string): string | null {
    return this.registry.get(toolName)?.serverName ?? null
  }

  /** Get health status of all MCP servers (for the dashboard) */
  getServerStatuses(): MCPServerStatus[] {
    const statuses: MCPServerStatus[] = []

    for (const config of this.configs) {
      const conn = this.connections.get(config.name)
      statuses.push({
        name: config.name,
        status: conn?.status ?? "disconnected",
        tools: conn?.tools ?? [],
        lastConnected: conn?.lastConnected?.toISOString(),
        error: conn?.error,
      })
    }

    return statuses
  }

  /**
   * Handle MCP server disconnect — mark as unhealthy, attempt reconnection.
   */
  private handleDisconnect(serverName: string): void {
    const conn = this.connections.get(serverName)
    if (!conn) return

    console.error(`[mcp] ${serverName} disconnected`)
    conn.status = "disconnected"
    conn.error = "Server process exited unexpectedly"

    // Remove this server's tools from the registry
    for (const toolName of conn.tools) {
      this.registry.delete(toolName)
    }

    // Attempt reconnection with exponential backoff
    this.attemptReconnect(serverName)
  }

  private async attemptReconnect(serverName: string): Promise<void> {
    const conn = this.connections.get(serverName)
    if (!conn) return

    if (conn.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(
        `[mcp] ${serverName}: max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`
      )
      conn.status = "disconnected"
      conn.error = `Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`
      return
    }

    conn.reconnectAttempts++
    conn.status = "reconnecting"

    const delay = RECONNECT_BASE_DELAY_MS * Math.pow(2, conn.reconnectAttempts - 1)
    console.log(
      `[mcp] ${serverName}: reconnecting in ${delay}ms (attempt ${conn.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
    )

    await new Promise((resolve) => setTimeout(resolve, delay))

    try {
      this.connections.delete(serverName)

      await this.connectServer(conn.config)
      console.log(`[mcp] ${serverName}: reconnected successfully`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[mcp] ${serverName}: reconnection failed: ${message}`)

      const updatedConn = this.connections.get(serverName)
      if (updatedConn) {
        updatedConn.reconnectAttempts = conn.reconnectAttempts
      } else {
        this.connections.set(serverName, conn)
      }

      this.attemptReconnect(serverName)
    }
  }

  /** Gracefully disconnect all servers */
  async disconnectAll(): Promise<void> {
    for (const [name, conn] of this.connections) {
      try {
        await conn.transport.close()
        console.log(`[mcp] ${name}: disconnected`)
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.connections.clear()
    this.registry.clear()
  }
}
