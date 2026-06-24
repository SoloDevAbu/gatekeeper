/**
 * ToolBlockEvaluator — Blocks a tool call entirely.
 *
 * This is the simplest evaluator. If the rule matches, the tool is blocked.
 * The assignment's primary demo: "never allow delete_secret".
 */

import type { ToolExecutionIntent, GuardrailDecision, ToolBlockConfig } from "@repo/types"
import type { PolicyRuleData, EvaluationContext } from "../types.js"
import type { RuleEvaluator } from "./evaluator.interface.js"

export class ToolBlockEvaluator implements RuleEvaluator {
  readonly ruleType = "TOOL_BLOCK"

  canHandle(rule: PolicyRuleData): boolean {
    return rule.type === this.ruleType
  }

  evaluate(
    rule: PolicyRuleData,
    intent: ToolExecutionIntent,
    _context: EvaluationContext
  ): GuardrailDecision {
    const config = rule.config as ToolBlockConfig

    return {
      action: "BLOCK",
      reason:
        config.message ??
        `Tool "${intent.toolName}" is blocked by policy rule (pattern: "${rule.toolPattern}").`,
      ruleId: rule.id,
    }
  }
}
