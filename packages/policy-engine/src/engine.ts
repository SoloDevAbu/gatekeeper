/**
 * PolicyEngine — The heart of Gatekeeper.
 *
 * A self-contained, framework-agnostic policy evaluation engine.
 * It takes tool call intents and evaluates them against cached rules,
 * returning ALLOW | BLOCK | REQUIRE_APPROVAL decisions.
 *
 * Key design decisions:
 * - Zero DB/framework dependencies — rules are fed in via reloadRules()
 * - Evaluator pattern (Strategy) — each rule type has its own evaluator
 * - matchRules() and resolveConflicts() are public for testability
 * - Token tracking is in-memory per conversation (resets on restart)
 *
 * How it wires into the system:
 * 1. Agent service loads rules from DB → calls engine.reloadRules(rules)
 * 2. EventBus emits "policy_changed" → agent service reloads from DB → calls reloadRules() again
 * 3. Agent loop calls engine.evaluate(intent) before every MCP tool call
 * 4. After each LLM response, agent calls engine.trackTokenUsage(convId, tokens)
 */

import type { ToolExecutionIntent, GuardrailDecision } from "@repo/types"
import type { PolicyRuleData, EvaluationContext } from "./types.js"
import { matchPattern, patternSpecificity } from "./pattern-matcher.js"
import { defaultEvaluators, type RuleEvaluator } from "./evaluators/index.js"

export class PolicyEngine {
  private cachedRules: PolicyRuleData[] = []
  private evaluators: RuleEvaluator[]
  private tokenUsage: Map<string, number> = new Map()

  /**
   * @param evaluators - Custom evaluators (defaults to all 5 built-in evaluators)
   */
  constructor(evaluators?: RuleEvaluator[]) {
    this.evaluators = evaluators ?? defaultEvaluators()
  }

  // ─── Core API ───────────────────────────────────────────────────────────

  /**
   * Hot-reload rules from DB. Call this on startup and whenever rules change.
   * Only enabled rules are cached. No restart required.
   */
  reloadRules(rules: PolicyRuleData[]): void {
    this.cachedRules = rules.filter((r) => r.enabled)
  }

  /**
   * Evaluate a tool call intent against all cached rules.
   * Returns the decision from the highest-priority matching rule.
   * If no rules match, returns ALLOW (default-open).
   */
  evaluate(intent: ToolExecutionIntent): GuardrailDecision {
    const matches = this.matchRules(intent)
    const winningRule = this.resolveConflicts(matches)

    // No matching rules → default ALLOW
    if (!winningRule) {
      return { action: "ALLOW" }
    }

    // Find the evaluator that handles this rule type
    const evaluator = this.evaluators.find((e) => e.canHandle(winningRule))

    if (!evaluator) {
      // Unknown rule type — fail open (ALLOW) rather than crashing
      return { action: "ALLOW" }
    }

    // Build evaluation context with runtime state
    const context: EvaluationContext = {
      tokenUsage: this.tokenUsage.get(intent.conversationId) ?? 0,
    }

    return evaluator.evaluate(winningRule, intent, context)
  }

  /**
   * Track token usage for a conversation. Called after each LLM response.
   * Used by BudgetLimitEvaluator to enforce token budgets.
   */
  trackTokenUsage(conversationId: string, tokens: number): void {
    const current = this.tokenUsage.get(conversationId) ?? 0
    this.tokenUsage.set(conversationId, current + tokens)
  }

  /**
   * Get current token usage for a conversation.
   */
  getTokenUsage(conversationId: string): number {
    return this.tokenUsage.get(conversationId) ?? 0
  }

  /**
   * Reset token usage for a conversation (e.g., when conversation ends).
   */
  resetTokenUsage(conversationId: string): void {
    this.tokenUsage.delete(conversationId)
  }

  /**
   * Get the current cached rule count (useful for dashboard metrics).
   */
  getRuleCount(): number {
    return this.cachedRules.length
  }

  // ─── Testable Internals ─────────────────────────────────────────────────

  /**
   * Find all rules that match the given intent.
   * A rule matches if:
   *   1. Its toolPattern matches the intent's toolName
   *   2. Its namespacePattern (if set) matches the intent's namespace argument
   *
   * Exposed as public for unit testing.
   */
  matchRules(intent: ToolExecutionIntent): PolicyRuleData[] {
    return this.cachedRules.filter((rule) => {
      // Check tool name match
      if (!matchPattern(rule.toolPattern, intent.toolName)) {
        return false
      }

      // Check namespace match (if the rule has a namespace pattern)
      if (rule.namespacePattern !== null && rule.namespacePattern !== undefined) {
        const intentNamespace = intent.arguments["namespace"]

        // If the rule requires a namespace but the intent has none, no match
        if (intentNamespace === undefined) {
          return false
        }

        if (!matchPattern(rule.namespacePattern, String(intentNamespace))) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Given multiple matching rules, pick the winning one using a 3-tier tiebreaker:
   *   1. Lowest priority number wins (priority 10 beats priority 100)
   *   2. Most specific toolPattern wins (fewer wildcards)
   *   3. Most restrictive action wins (BLOCK > REQUIRE_APPROVAL)
   *
   * Exposed as public for unit testing.
   */
  resolveConflicts(matches: PolicyRuleData[]): PolicyRuleData | null {
    if (matches.length === 0) return null
    if (matches.length === 1) return matches[0]!

    const sorted = [...matches].sort((a, b) => {
      // Tier 1: Lower priority number wins
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }

      // Tier 2: More specific pattern wins (fewer wildcards)
      const aSpec = patternSpecificity(a.toolPattern)
      const bSpec = patternSpecificity(b.toolPattern)
      if (aSpec !== bSpec) {
        return aSpec - bSpec
      }

      // Tier 3: More restrictive action wins
      const actionOrder: Record<string, number> = {
        BLOCK: 0,
        REQUIRE_APPROVAL: 1,
      }
      const aOrder = actionOrder[a.action] ?? 2
      const bOrder = actionOrder[b.action] ?? 2
      return aOrder - bOrder
    })

    return sorted[0]!
  }
}
