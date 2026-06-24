/**
 * Internal types for the policy engine.
 *
 * The engine is decoupled from Drizzle — it works with plain objects.
 * The agent-service maps DB rows to these shapes before passing them in.
 *
 * Re-exports shared types from @repo/types for convenience.
 */

// Re-export shared types so consumers only need to import from @repo/policy-engine
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
} from "@repo/types"

/**
 * A policy rule as consumed by the engine.
 * This mirrors the DB schema shape but is a plain interface (no Drizzle dependency).
 * The agent-service maps `PolicyRule` DB rows to this shape.
 */
export interface PolicyRuleData {
  id: string
  type: string
  toolPattern: string
  namespacePattern: string | null
  action: string
  config: Record<string, unknown>
  enabled: boolean
  priority: number
}

/**
 * Context passed to evaluators alongside the rule and intent.
 * Carries runtime state like token usage that evaluators may need.
 */
export interface EvaluationContext {
  /** Total tokens consumed by this conversation so far */
  tokenUsage: number
}
