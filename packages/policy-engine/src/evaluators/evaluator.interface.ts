/**
 * RuleEvaluator interface — the Strategy pattern for rule evaluation.
 *
 * Each rule type has its own evaluator that knows how to interpret the
 * rule's config and produce a GuardrailDecision. This makes it trivial
 * to add new rule types without modifying the core engine.
 */

import type { ToolExecutionIntent, GuardrailDecision } from "@repo/types"
import type { PolicyRuleData, EvaluationContext } from "../types.js"

export interface RuleEvaluator {
  /** The rule type this evaluator handles (e.g. "TOOL_BLOCK") */
  readonly ruleType: string

  /**
   * Check if this evaluator can handle the given rule.
   * Typically just checks rule.type === this.ruleType.
   */
  canHandle(rule: PolicyRuleData): boolean

  /**
   * Evaluate the rule against the intent and return a decision.
   * Called only after canHandle() returns true.
   */
  evaluate(
    rule: PolicyRuleData,
    intent: ToolExecutionIntent,
    context: EvaluationContext
  ): GuardrailDecision
}
