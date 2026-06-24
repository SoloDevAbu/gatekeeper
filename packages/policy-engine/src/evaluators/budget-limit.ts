/**
 * BudgetLimitEvaluator — Enforces token budget per conversation.
 *
 * Assignment requirement: "Cost/token budget per conversation"
 *
 * This evaluator checks if the conversation has exceeded its token budget.
 * If so, ALL tool calls for that conversation are blocked.
 * The toolPattern on this rule type is typically "*" (applies to all tools).
 */

import type { ToolExecutionIntent, GuardrailDecision, BudgetLimitConfig } from "@repo/types"
import type { PolicyRuleData, EvaluationContext } from "../types.js"
import type { RuleEvaluator } from "./evaluator.interface.js"

export class BudgetLimitEvaluator implements RuleEvaluator {
  readonly ruleType = "BUDGET_LIMIT"

  canHandle(rule: PolicyRuleData): boolean {
    return rule.type === this.ruleType
  }

  evaluate(
    rule: PolicyRuleData,
    _intent: ToolExecutionIntent,
    context: EvaluationContext
  ): GuardrailDecision {
    const config = rule.config as unknown as BudgetLimitConfig

    if (!config.maxTokens || config.maxTokens <= 0) {
      return { action: "ALLOW" }
    }

    if (context.tokenUsage >= config.maxTokens) {
      return {
        action: "BLOCK",
        reason: `Token budget exceeded: ${context.tokenUsage.toLocaleString()} / ${config.maxTokens.toLocaleString()} tokens used for this conversation.`,
        ruleId: rule.id,
      }
    }

    return { action: "ALLOW" }
  }
}
