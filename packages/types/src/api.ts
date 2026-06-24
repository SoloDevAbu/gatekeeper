// ─── API Types ──────────────────────────────────────────────────────────────
// Request/response shapes for the agent-service REST API.

/**
 * POST /api/chat — request body
 */
export interface ChatRequest {
  message: string
  conversationId?: string
}

/**
 * POST /api/chat — response body
 */
export interface ChatResponse {
  conversationId: string
  response: string
}

/**
 * GET /api/conversations — a single conversation summary
 */
export interface ConversationSummary {
  conversationId: string
  messageCount: number
  toolCallCount: number
  blockedCount: number
  lastMessageAt: string
  /** Preview of the first user message */
  preview: string
}

/**
 * A single log entry in a conversation — returned by GET /api/conversations/:id/logs
 */
export interface ConversationLogEntry {
  id: string
  conversationId: string
  role: "user" | "assistant" | "tool_result" | "system"
  content: string
  metadata: Record<string, unknown>
  createdAt: string
}

/**
 * POST /api/policies — request body for creating a new rule
 */
export interface CreatePolicyRequest {
  type: string
  toolPattern: string
  namespacePattern?: string | null
  action: string
  config?: Record<string, unknown>
  enabled?: boolean
  priority?: number
}

/**
 * PUT /api/policies/:id — request body for updating an existing rule
 */
export interface UpdatePolicyRequest {
  type?: string
  toolPattern?: string
  namespacePattern?: string | null
  action?: string
  config?: Record<string, unknown>
  enabled?: boolean
  priority?: number
}

/**
 * PATCH /api/policies/:id/toggle — request body
 */
export interface TogglePolicyRequest {
  enabled: boolean
}

/**
 * Generic success response
 */
export interface SuccessResponse {
  success: true
}

/**
 * Generic error response
 */
export interface ErrorResponse {
  error: string
  message: string
  statusCode: number
}
