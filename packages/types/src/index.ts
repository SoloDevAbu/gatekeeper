// ─── @repo/types ────────────────────────────────────────────────────────────
// Barrel export for all shared Gatekeeper types.
//
// Usage:
//   import type { ToolExecutionIntent, SSEEvent, MCPServerConfig } from "@repo/types"

// Policy engine types
export type {
  RuleType,
  DecisionAction,
  RuleAction,
  ToolExecutionIntent,
  GuardrailDecision,
  ToolBlockConfig,
  RequireApprovalConfig,
  InputValidationConfig,
  BudgetLimitConfig,
  NamespaceRestrictionConfig,
  RuleConfig,
} from "./policy"

// SSE event types
export type {
  SSEEventType,
  SSEEvent,
  ThinkingEventData,
  AssistantMessageEventData,
  ToolCallIntentEventData,
  ToolCallResultEventData,
  ToolCallBlockedEventData,
  ApprovalRequestedEventData,
  ApprovalDecidedEventData,
  PolicyChangedEventData,
  ErrorEventData,
} from "./events"

// MCP types
export type {
  MCPServerConfig,
  MCPServerStatus,
  DiscoveredTool,
} from "./mcp"

// Approval queue types
export type {
  ApprovalDecision,
  ApprovalStatus,
  PendingApproval,
  ApprovalDecisionRequest,
  PendingApprovalSummary,
} from "./approval"

// API request/response types
export type {
  ChatRequest,
  ChatResponse,
  ConversationSummary,
  ConversationLogEntry,
  CreatePolicyRequest,
  UpdatePolicyRequest,
  TogglePolicyRequest,
  SuccessResponse,
  ErrorResponse,
} from "./api"
