import { describe, it, expect, beforeEach } from "vitest"
import { PolicyEngine } from "../src/engine.js"
import type { PolicyRuleData } from "../src/types.js"
import type { ToolExecutionIntent } from "@repo/types"

// ─── Test Helpers ────────────────────────────────────────────────────────────

function makeIntent(overrides: Partial<ToolExecutionIntent> = {}): ToolExecutionIntent {
  return {
    conversationId: "conv-1",
    toolName: "get_secret",
    mcpServer: "vault-mcp",
    arguments: { namespace: "dev", key: "api_key" },
    timestamp: new Date(),
    ...overrides,
  }
}

function makeRule(overrides: Partial<PolicyRuleData> = {}): PolicyRuleData {
  return {
    id: "rule-1",
    type: "TOOL_BLOCK",
    toolPattern: "delete_secret",
    namespacePattern: null,
    action: "BLOCK",
    config: {},
    enabled: true,
    priority: 100,
    ...overrides,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PolicyEngine", () => {
  let engine: PolicyEngine

  beforeEach(() => {
    engine = new PolicyEngine()
  })

  // ── Default Behavior ──────────────────────────────────────────────────

  describe("default behavior (no rules)", () => {
    it("returns ALLOW when no rules are loaded", () => {
      const decision = engine.evaluate(makeIntent())
      expect(decision.action).toBe("ALLOW")
    })

    it("returns ALLOW when no rules match", () => {
      engine.reloadRules([makeRule({ toolPattern: "delete_secret" })])
      const decision = engine.evaluate(makeIntent({ toolName: "list_secrets" }))
      expect(decision.action).toBe("ALLOW")
    })
  })

  // ── TOOL_BLOCK ────────────────────────────────────────────────────────

  describe("TOOL_BLOCK evaluator", () => {
    it("blocks a tool by exact name", () => {
      engine.reloadRules([makeRule({ toolPattern: "delete_secret" })])
      const decision = engine.evaluate(makeIntent({ toolName: "delete_secret" }))
      expect(decision.action).toBe("BLOCK")
      expect(decision.reason).toContain("delete_secret")
      expect(decision.ruleId).toBe("rule-1")
    })

    it("blocks with wildcard pattern *", () => {
      engine.reloadRules([makeRule({ toolPattern: "*" })])
      const decision = engine.evaluate(makeIntent({ toolName: "anything" }))
      expect(decision.action).toBe("BLOCK")
    })

    it("blocks with glob pattern get_*", () => {
      engine.reloadRules([makeRule({ toolPattern: "get_*" })])
      const decision = engine.evaluate(makeIntent({ toolName: "get_secret" }))
      expect(decision.action).toBe("BLOCK")
    })

    it("uses custom message from config", () => {
      engine.reloadRules([
        makeRule({
          toolPattern: "delete_secret",
          config: { message: "Deletion is forbidden in this environment." },
        }),
      ])
      const decision = engine.evaluate(makeIntent({ toolName: "delete_secret" }))
      expect(decision.action).toBe("BLOCK")
      expect(decision.reason).toBe("Deletion is forbidden in this environment.")
    })
  })

  // ── REQUIRE_APPROVAL ──────────────────────────────────────────────────

  describe("REQUIRE_APPROVAL evaluator", () => {
    it("returns REQUIRE_APPROVAL with default timeout", () => {
      engine.reloadRules([
        makeRule({
          type: "REQUIRE_APPROVAL",
          toolPattern: "set_secret",
          action: "REQUIRE_APPROVAL",
          config: {},
        }),
      ])
      const decision = engine.evaluate(makeIntent({ toolName: "set_secret" }))
      expect(decision.action).toBe("REQUIRE_APPROVAL")
      expect(decision.timeoutMs).toBe(300_000) // 5 minutes
    })

    it("uses custom timeout from config", () => {
      engine.reloadRules([
        makeRule({
          type: "REQUIRE_APPROVAL",
          toolPattern: "set_secret",
          action: "REQUIRE_APPROVAL",
          config: { timeoutMs: 60_000 },
        }),
      ])
      const decision = engine.evaluate(makeIntent({ toolName: "set_secret" }))
      expect(decision.timeoutMs).toBe(60_000)
    })
  })

  // ── INPUT_VALIDATION ──────────────────────────────────────────────────

  describe("INPUT_VALIDATION evaluator", () => {
    it("allows when input matches pattern", () => {
      engine.reloadRules([
        makeRule({
          type: "INPUT_VALIDATION",
          toolPattern: "*",
          action: "BLOCK",
          config: { field: "namespace", pattern: "^(dev|staging)$", message: "Only dev/staging allowed" },
        }),
      ])
      const decision = engine.evaluate(
        makeIntent({ arguments: { namespace: "dev" } })
      )
      expect(decision.action).toBe("ALLOW")
    })

    it("blocks when input violates pattern", () => {
      engine.reloadRules([
        makeRule({
          type: "INPUT_VALIDATION",
          toolPattern: "*",
          action: "BLOCK",
          config: { field: "namespace", pattern: "^(dev|staging)$", message: "Only dev/staging allowed" },
        }),
      ])
      const decision = engine.evaluate(
        makeIntent({ arguments: { namespace: "prod" } })
      )
      expect(decision.action).toBe("BLOCK")
      expect(decision.reason).toBe("Only dev/staging allowed")
    })

    it("allows when the validated field is absent from arguments", () => {
      engine.reloadRules([
        makeRule({
          type: "INPUT_VALIDATION",
          toolPattern: "*",
          action: "BLOCK",
          config: { field: "namespace", pattern: "^dev$", message: "Nope" },
        }),
      ])
      const decision = engine.evaluate(makeIntent({ arguments: {} }))
      expect(decision.action).toBe("ALLOW")
    })
  })

  // ── BUDGET_LIMIT ──────────────────────────────────────────────────────

  describe("BUDGET_LIMIT evaluator", () => {
    it("allows when under budget", () => {
      engine.reloadRules([
        makeRule({
          type: "BUDGET_LIMIT",
          toolPattern: "*",
          action: "BLOCK",
          config: { maxTokens: 10000 },
        }),
      ])
      engine.trackTokenUsage("conv-1", 5000)
      const decision = engine.evaluate(makeIntent({ conversationId: "conv-1" }))
      expect(decision.action).toBe("ALLOW")
    })

    it("blocks when budget exceeded", () => {
      engine.reloadRules([
        makeRule({
          type: "BUDGET_LIMIT",
          toolPattern: "*",
          action: "BLOCK",
          config: { maxTokens: 10000 },
        }),
      ])
      engine.trackTokenUsage("conv-1", 10000)
      const decision = engine.evaluate(makeIntent({ conversationId: "conv-1" }))
      expect(decision.action).toBe("BLOCK")
      expect(decision.reason).toContain("10,000")
    })

    it("tracks cumulative token usage", () => {
      engine.trackTokenUsage("conv-1", 3000)
      engine.trackTokenUsage("conv-1", 4000)
      expect(engine.getTokenUsage("conv-1")).toBe(7000)
    })
  })

  // ── NAMESPACE_RESTRICTION ─────────────────────────────────────────────

  describe("NAMESPACE_RESTRICTION evaluator", () => {
    it("allows when namespace is in the allowlist", () => {
      engine.reloadRules([
        makeRule({
          type: "NAMESPACE_RESTRICTION",
          toolPattern: "*",
          action: "BLOCK",
          config: { allowedNamespaces: ["dev", "staging"] },
        }),
      ])
      const decision = engine.evaluate(
        makeIntent({ arguments: { namespace: "dev" } })
      )
      expect(decision.action).toBe("ALLOW")
    })

    it("blocks when namespace is not in the allowlist", () => {
      engine.reloadRules([
        makeRule({
          type: "NAMESPACE_RESTRICTION",
          toolPattern: "*",
          action: "BLOCK",
          config: { allowedNamespaces: ["dev", "staging"] },
        }),
      ])
      const decision = engine.evaluate(
        makeIntent({ arguments: { namespace: "prod" } })
      )
      expect(decision.action).toBe("BLOCK")
      expect(decision.reason).toContain("prod")
      expect(decision.reason).toContain("dev, staging")
    })

    it("allows when tool has no namespace argument", () => {
      engine.reloadRules([
        makeRule({
          type: "NAMESPACE_RESTRICTION",
          toolPattern: "*",
          action: "BLOCK",
          config: { allowedNamespaces: ["dev"] },
        }),
      ])
      const decision = engine.evaluate(makeIntent({ arguments: {} }))
      expect(decision.action).toBe("ALLOW")
    })
  })

  // ── Namespace Pattern on Rules ────────────────────────────────────────

  describe("namespace pattern matching on rules", () => {
    it("matches when rule namespacePattern matches intent namespace", () => {
      engine.reloadRules([
        makeRule({
          toolPattern: "set_secret",
          namespacePattern: "prod",
        }),
      ])
      const decision = engine.evaluate(
        makeIntent({ toolName: "set_secret", arguments: { namespace: "prod", key: "x" } })
      )
      expect(decision.action).toBe("BLOCK")
    })

    it("does not match when namespace differs", () => {
      engine.reloadRules([
        makeRule({
          toolPattern: "set_secret",
          namespacePattern: "prod",
        }),
      ])
      const decision = engine.evaluate(
        makeIntent({ toolName: "set_secret", arguments: { namespace: "dev", key: "x" } })
      )
      expect(decision.action).toBe("ALLOW")
    })

    it("matches glob namespace patterns: prod/*", () => {
      engine.reloadRules([
        makeRule({
          toolPattern: "*",
          namespacePattern: "prod*",
        }),
      ])
      const decision = engine.evaluate(
        makeIntent({ arguments: { namespace: "prod-us-east" } })
      )
      expect(decision.action).toBe("BLOCK")
    })
  })

  // ── Conflict Resolution ───────────────────────────────────────────────

  describe("conflict resolution", () => {
    it("lower priority number wins", () => {
      engine.reloadRules([
        makeRule({
          id: "high-priority",
          type: "REQUIRE_APPROVAL",
          toolPattern: "*",
          action: "REQUIRE_APPROVAL",
          priority: 10,
          config: {},
        }),
        makeRule({
          id: "low-priority",
          toolPattern: "*",
          action: "BLOCK",
          priority: 100,
        }),
      ])
      const decision = engine.evaluate(makeIntent())
      expect(decision.action).toBe("REQUIRE_APPROVAL")
    })

    it("more specific pattern wins at same priority", () => {
      engine.reloadRules([
        makeRule({
          id: "specific",
          toolPattern: "get_secret",
          action: "BLOCK",
          priority: 100,
        }),
        makeRule({
          id: "generic",
          type: "REQUIRE_APPROVAL",
          toolPattern: "*",
          action: "REQUIRE_APPROVAL",
          priority: 100,
          config: {},
        }),
      ])
      const decision = engine.evaluate(makeIntent({ toolName: "get_secret" }))
      expect(decision.action).toBe("BLOCK")
    })

    it("more restrictive action wins when everything else is equal", () => {
      engine.reloadRules([
        makeRule({
          id: "block-rule",
          toolPattern: "get_secret",
          action: "BLOCK",
          priority: 100,
        }),
        makeRule({
          id: "approval-rule",
          type: "REQUIRE_APPROVAL",
          toolPattern: "get_secret",
          action: "REQUIRE_APPROVAL",
          priority: 100,
          config: {},
        }),
      ])
      const decision = engine.evaluate(makeIntent({ toolName: "get_secret" }))
      expect(decision.action).toBe("BLOCK")
    })
  })

  // ── reloadRules Behavior ──────────────────────────────────────────────

  describe("reloadRules", () => {
    it("filters out disabled rules", () => {
      engine.reloadRules([
        makeRule({ toolPattern: "delete_secret", enabled: false }),
      ])
      const decision = engine.evaluate(makeIntent({ toolName: "delete_secret" }))
      expect(decision.action).toBe("ALLOW")
    })

    it("replaces previous rules entirely", () => {
      engine.reloadRules([makeRule({ toolPattern: "delete_secret" })])
      expect(engine.evaluate(makeIntent({ toolName: "delete_secret" })).action).toBe("BLOCK")

      engine.reloadRules([]) // clear all rules
      expect(engine.evaluate(makeIntent({ toolName: "delete_secret" })).action).toBe("ALLOW")
    })
  })
})
