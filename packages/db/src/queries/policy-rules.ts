import db from "../index.js"
import { policyRules } from "../schema.js"
import { eq } from "drizzle-orm"

export async function getAllPolicyRules() {
  const rules = await db.select().from(policyRules)
  return rules.map((r) => ({
    ...r,
    config: r.config as Record<string, unknown>,
  }))
}

export async function createPolicyRule(data: typeof policyRules.$inferInsert) {
  const [rule] = await db.insert(policyRules).values(data).returning()
  return rule
}

export async function getPolicyRuleById(id: string) {
  const [rule] = await db.select().from(policyRules).where(eq(policyRules.id, id))
  return rule
}

export async function updatePolicyRule(id: string, data: Partial<typeof policyRules.$inferInsert>) {
  const [updated] = await db
    .update(policyRules)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(policyRules.id, id))
    .returning()
  return updated
}

export async function deletePolicyRule(id: string) {
  const result = await db
    .delete(policyRules)
    .where(eq(policyRules.id, id))
    .returning({ id: policyRules.id })
  return result
}

export async function togglePolicyRule(id: string, enabled: boolean) {
  const [updated] = await db
    .update(policyRules)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(policyRules.id, id))
    .returning()
  return updated
}
