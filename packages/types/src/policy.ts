// ─── Policy Engine Types ────────────────────────────────────────────────────
// These types define the contract between the policy engine, agent service,
// and dashboard. They are intentionally decoupled from Drizzle ORM types
// so the policy-engine package has zero DB dependencies.

/**
 * The 5 guardrail rule types supported by the policy engine.
 *
 * - TOOL_BLOCK: Block a tool entirely
 * - REQUIRE_APPROVAL: Pause and wait for human approval
 * - INPUT_VALIDATION: Validate tool arguments against a pattern
 * - BUDGET_LIMIT: Enforce token/cost budget per conversation
 * - NAMESPACE_RESTRICTION: Restrict tools to specific namespaces
 */
export type RuleType =
  | "TOOL_BLOCK"
  | "REQUIRE_APPROVAL"
  | "INPUT_VALIDATION"
  | "BUDGET_LIMIT"
  | "NAMESPACE_RESTRICTION"

/**
 * The 3 possible outcomes when the policy engine evaluates a tool call.
 */
export type DecisionAction = "ALLOW" | "BLOCK" | "REQUIRE_APPROVAL"

/**
 * The action a policy rule enforces.
 * Maps 1:1 with the `action` column in `policy_rules`.
 */
export type RuleAction = "BLOCK" | "REQUIRE_APPROVAL"

/**
 * A tool call the LLM wants to make — this is what the policy engine evaluates.
 * Created by the agent loop before every MCP tool call.
 */
export interface ToolExecutionIntent {
  conversationId: string
  toolName: string
  mcpServer: string
  arguments: Record<string, unknown>
  timestamp: Date
}

/**
 * The policy engine's decision for a given ToolExecutionIntent.
 */
export interface GuardrailDecision {
  action: DecisionAction
  /** Human-readable reason (set when BLOCK) */
  reason?: string
  /** The rule that matched (set when BLOCK or REQUIRE_APPROVAL) */
  ruleId?: string
  /** Timeout for approval (set when REQUIRE_APPROVAL) */
  timeoutMs?: number
}

// ─── Rule Config Shapes ─────────────────────────────────────────────────────
// Each rule type has a specific `config` JSON shape stored in the DB.

/** Config for TOOL_BLOCK rules — no extra config needed */
export interface ToolBlockConfig {
  /** Optional custom block message */
  message?: string
}

/** Config for REQUIRE_APPROVAL rules */
export interface RequireApprovalConfig {
  /** How long to wait for approval before auto-denying (ms). Default: 300000 (5 min) */
  timeoutMs?: number
}

/** Config for INPUT_VALIDATION rules */
export interface InputValidationConfig {
  /** The argument field to validate (e.g. "namespace", "key") */
  field: string
  /** Regex pattern the field value must match */
  pattern: string
  /** Error message shown when validation fails */
  message: string
}

/** Config for BUDGET_LIMIT rules */
export interface BudgetLimitConfig {
  /** Max tokens allowed per conversation */
  maxTokens: number
}

/** Config for NAMESPACE_RESTRICTION rules */
export interface NamespaceRestrictionConfig {
  /** List of allowed namespace values (e.g. ["dev", "staging"]) */
  allowedNamespaces: string[]
}

/**
 * Union of all possible rule configs.
 * Use this when you need to handle any config shape generically.
 */
export type RuleConfig =
  | ToolBlockConfig
  | RequireApprovalConfig
  | InputValidationConfig
  | BudgetLimitConfig
  | NamespaceRestrictionConfig
