// packages/db/src/schema.ts
import {
  pgTable,
  uuid,
  varchar,
  boolean,
  integer,
  text,
  jsonb,
  timestamp,
  unique
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

// ─── policy_rules ───────────────────────────────────────────────────────────

export const policyRules = pgTable("policy_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 50 }).notNull(),
  // e.g. "delete_secret", "*", "get_secret"
  toolPattern: varchar("tool_pattern", { length: 255 }).notNull(),
  // e.g. "prod/*", "dev/*", "*" — null means applies to all namespaces
  namespacePattern: varchar("namespace_pattern", { length: 255 }),
  // BLOCK | REQUIRE_APPROVAL
  action: varchar("action", { length: 50 }).notNull(),
  // extra config per rule type e.g. { maxTokens: 1000 } for budget rules
  config: jsonb("config").default({}).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  // lower number = higher priority, evaluated first
  priority: integer("priority").default(100).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// ─── tool_intents ────────────────────────────────────────────────────────────

export const toolIntents = pgTable("tool_intents", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: varchar("conversation_id", { length: 255 }).notNull(),
  toolName: varchar("tool_name", { length: 255 }).notNull(),
  mcpServer: varchar("mcp_server", { length: 255 }).notNull(),
  // full arguments the model passed e.g. { namespace: "prod", key: "stripe_key" }
  arguments: jsonb("arguments").default({}).notNull(),
  // ALLOW | BLOCK | REQUIRE_APPROVAL
  decision: varchar("decision", { length: 50 }).notNull(),
  matchedRuleId: uuid("matched_rule_id").references(() => policyRules.id, {
    onDelete: "set null",
  }),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// ─── approval_requests ───────────────────────────────────────────────────────

export const approvalRequests = pgTable("approval_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  intentId: uuid("intent_id")
    .notNull()
    .references(() => toolIntents.id, { onDelete: "cascade" }),
  // PENDING | APPROVED | DENIED | EXPIRED
  status: varchar("status", { length: 50 }).default("PENDING").notNull(),
  decidedBy: varchar("decided_by", { length: 255 }),
  reason: text("reason"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
})

// ─── conversation_logs ───────────────────────────────────────────────────────

export const conversationLogs = pgTable("conversation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: varchar("conversation_id", { length: 255 }).notNull(),
  // user | assistant | tool_result | system
  role: varchar("role", { length: 50 }).notNull(),
  content: text("content").notNull(),
  // e.g. { toolName, decision, approvalId } for tool turns
  metadata: jsonb("metadata").default({}).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
})

// ─── Relations ───────────────────────────────────────────────────────────────

export const policyRulesRelations = relations(policyRules, ({ many }) => ({
  toolIntents: many(toolIntents),
}))

export const toolIntentsRelations = relations(toolIntents, ({ one }) => ({
  matchedRule: one(policyRules, {
    fields: [toolIntents.matchedRuleId],
    references: [policyRules.id],
  }),
  approvalRequest: one(approvalRequests, {
    fields: [toolIntents.id],
    references: [approvalRequests.intentId],
  }),
}))

export const approvalRequestsRelations = relations(
  approvalRequests,
  ({ one }) => ({
    intent: one(toolIntents, {
      fields: [approvalRequests.intentId],
      references: [toolIntents.id],
    }),
  })
)

export const vaultSecrets = pgTable("vault_secrets", {
  id: uuid("id").primaryKey().defaultRandom(),
  namespace: varchar("namespace", { length: 100 }).notNull(), // "prod" | "dev"
  key: varchar("key", { length: 255 }).notNull(),            // "stripe_key", "openai_key"
  value: text("value").notNull(),                            // the actual secret value
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueNamespaceKey: unique().on(table.namespace, table.key),
}));

// ─── Types ───────────────────────────────────────────────────────────────────

export type PolicyRule = typeof policyRules.$inferSelect
export type NewPolicyRule = typeof policyRules.$inferInsert

export type ToolIntent = typeof toolIntents.$inferSelect
export type NewToolIntent = typeof toolIntents.$inferInsert

export type ApprovalRequest = typeof approvalRequests.$inferSelect
export type NewApprovalRequest = typeof approvalRequests.$inferInsert

export type ConversationLog = typeof conversationLogs.$inferSelect
export type NewConversationLog = typeof conversationLogs.$inferInsert

export type VaultSecret = typeof vaultSecrets.$inferSelect
export type NewVaultSecret = typeof vaultSecrets.$inferInsert
