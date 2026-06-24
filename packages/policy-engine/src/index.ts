/**
 * @repo/policy-engine — Public API
 *
 * Usage:
 *   import { PolicyEngine } from "@repo/policy-engine"
 *   import type { PolicyRuleData, ToolExecutionIntent, GuardrailDecision } from "@repo/policy-engine"
 *
 *   const engine = new PolicyEngine()
 *   engine.reloadRules(rulesFromDB)
 *   const decision = engine.evaluate(intent)
 */

// Core engine
export { PolicyEngine } from "./engine.js"

// Types
export type { PolicyRuleData, EvaluationContext } from "./types.js"

// Re-export shared types for convenience (consumers don't need to import @repo/types separately)
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
} from "./types.js"

// Evaluators (for advanced use — custom evaluator injection)
export type { RuleEvaluator } from "./evaluators/index.js"
export {
  ToolBlockEvaluator,
  RequireApprovalEvaluator,
  InputValidationEvaluator,
  BudgetLimitEvaluator,
  NamespaceRestrictionEvaluator,
  defaultEvaluators,
} from "./evaluators/index.js"

// Pattern matcher (for use in dashboard conflict detection)
export { matchPattern, patternSpecificity } from "./pattern-matcher.js"
