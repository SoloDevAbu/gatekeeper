/**
 * InputValidationEvaluator — Validates tool arguments against regex patterns.
 *
 * Assignment requirement: "Input validation rules (e.g. file paths must be under /sandbox/ only)"
 *
 * This evaluator checks a specific argument field against a regex pattern.
 * If the field value doesn't match the pattern, the tool call is BLOCKED.
 */

import type { ToolExecutionIntent, GuardrailDecision, InputValidationConfig } from "@repo/types"
import type { PolicyRuleData, EvaluationContext } from "../types.js"
import type { RuleEvaluator } from "./evaluator.interface.js"

export class InputValidationEvaluator implements RuleEvaluator {
  readonly ruleType = "INPUT_VALIDATION"

  canHandle(rule: PolicyRuleData): boolean {
    return rule.type === this.ruleType
  }

  evaluate(
    rule: PolicyRuleData,
    intent: ToolExecutionIntent,
    _context: EvaluationContext
  ): GuardrailDecision {
    const config = rule.config as unknown as InputValidationConfig

    // If config is incomplete, skip this rule (ALLOW)
    if (!config.field || !config.pattern) {
      return { action: "ALLOW" }
    }

    const fieldValue = intent.arguments[config.field]

    // If the field is not present in arguments, the validation doesn't apply
    if (fieldValue === undefined) {
      return { action: "ALLOW" }
    }

    // Convert to string for regex matching
    const valueStr = String(fieldValue)

    try {
      const regex = new RegExp(config.pattern)

      if (regex.test(valueStr)) {
        // Value matches the allowed pattern — ALLOW
        return { action: "ALLOW" }
      }

      // Value violates the pattern — BLOCK
      return {
        action: "BLOCK",
        reason:
          config.message ??
          `Input validation failed: "${config.field}" value "${valueStr}" does not match required pattern "${config.pattern}".`,
        ruleId: rule.id,
      }
    } catch {
      // Invalid regex in config — fail open (ALLOW) with a note
      // In production you'd log this as a config error
      return { action: "ALLOW" }
    }
  }
}
