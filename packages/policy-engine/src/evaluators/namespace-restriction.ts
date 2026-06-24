/**
 * NamespaceRestrictionEvaluator — Restricts tools to specific namespaces.
 *
 * Checks the "namespace" argument in the tool call against an allowlist.
 * If the namespace is not in the allowed list, the call is BLOCKED.
 *
 * This is a semantic evaluator — it understands that vault tools use
 * a "namespace" argument and validates it against allowed values.
 */

import type { ToolExecutionIntent, GuardrailDecision, NamespaceRestrictionConfig } from "@repo/types"
import type { PolicyRuleData, EvaluationContext } from "../types.js"
import type { RuleEvaluator } from "./evaluator.interface.js"

export class NamespaceRestrictionEvaluator implements RuleEvaluator {
  readonly ruleType = "NAMESPACE_RESTRICTION"

  canHandle(rule: PolicyRuleData): boolean {
    return rule.type === this.ruleType
  }

  evaluate(
    rule: PolicyRuleData,
    intent: ToolExecutionIntent,
    _context: EvaluationContext
  ): GuardrailDecision {
    const config = rule.config as unknown as NamespaceRestrictionConfig

    if (
      !config.allowedNamespaces ||
      !Array.isArray(config.allowedNamespaces) ||
      config.allowedNamespaces.length === 0
    ) {
      // No restriction configured — allow
      return { action: "ALLOW" }
    }

    const namespace = intent.arguments["namespace"]

    // If the tool doesn't have a namespace argument, this rule doesn't apply
    if (namespace === undefined) {
      return { action: "ALLOW" }
    }

    const namespaceStr = String(namespace)

    if (config.allowedNamespaces.includes(namespaceStr)) {
      return { action: "ALLOW" }
    }

    return {
      action: "BLOCK",
      reason: `Namespace "${namespaceStr}" is not allowed. Permitted namespaces: ${config.allowedNamespaces.join(", ")}.`,
      ruleId: rule.id,
    }
  }
}
