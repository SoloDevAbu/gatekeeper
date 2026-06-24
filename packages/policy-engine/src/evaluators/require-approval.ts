/**
 * RequireApprovalEvaluator — Pauses the agent loop to wait for human approval.
 *
 * Returns REQUIRE_APPROVAL with a timeout. The agent loop's ApprovalQueue
 * handles the actual Promise-based blocking.
 */

import type { ToolExecutionIntent, GuardrailDecision, RequireApprovalConfig } from "@repo/types"
import type { PolicyRuleData, EvaluationContext } from "../types.js"
import type { RuleEvaluator } from "./evaluator.interface.js"

/** Default approval timeout: 5 minutes */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000

export class RequireApprovalEvaluator implements RuleEvaluator {
  readonly ruleType = "REQUIRE_APPROVAL"

  canHandle(rule: PolicyRuleData): boolean {
    return rule.type === this.ruleType
  }

  evaluate(
    rule: PolicyRuleData,
    _intent: ToolExecutionIntent,
    _context: EvaluationContext
  ): GuardrailDecision {
    const config = rule.config as RequireApprovalConfig

    return {
      action: "REQUIRE_APPROVAL",
      ruleId: rule.id,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    }
  }
}
