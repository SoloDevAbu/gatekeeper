/**
 * Evaluator registry — barrel export + default evaluator set.
 *
 * Adding a new rule type is as simple as:
 * 1. Create a new evaluator class implementing RuleEvaluator
 * 2. Add it to defaultEvaluators()
 * 3. Add the corresponding RuleType to @repo/types
 */

export type { RuleEvaluator } from "./evaluator.interface.js"

export { ToolBlockEvaluator } from "./tool-block.js"
export { RequireApprovalEvaluator } from "./require-approval.js"
export { InputValidationEvaluator } from "./input-validation.js"
export { BudgetLimitEvaluator } from "./budget-limit.js"
export { NamespaceRestrictionEvaluator } from "./namespace-restriction.js"

import type { RuleEvaluator } from "./evaluator.interface.js"
import { ToolBlockEvaluator } from "./tool-block.js"
import { RequireApprovalEvaluator } from "./require-approval.js"
import { InputValidationEvaluator } from "./input-validation.js"
import { BudgetLimitEvaluator } from "./budget-limit.js"
import { NamespaceRestrictionEvaluator } from "./namespace-restriction.js"

/**
 * Returns the default set of all 5 evaluators.
 * The PolicyEngine uses this unless custom evaluators are injected.
 */
export function defaultEvaluators(): RuleEvaluator[] {
  return [
    new ToolBlockEvaluator(),
    new RequireApprovalEvaluator(),
    new InputValidationEvaluator(),
    new BudgetLimitEvaluator(),
    new NamespaceRestrictionEvaluator(),
  ]
}
