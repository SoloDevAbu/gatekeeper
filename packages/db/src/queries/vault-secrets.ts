import db from "../index.js"
import { vaultSecrets } from "../schema.js"
import { eq, and, sql } from "drizzle-orm"

export async function countVaultSecrets() {
  const existing = await db
    .select({ count: sql<number>`count(*)` })
    .from(vaultSecrets)
  return Number(existing[0]?.count ?? 0)
}

export async function insertVaultSecrets(data: (typeof vaultSecrets.$inferInsert)[]) {
  await db.insert(vaultSecrets).values(data)
}

export async function listVaultKeys(namespace: string) {
  const rows = await db
    .select({ key: vaultSecrets.key })
    .from(vaultSecrets)
    .where(eq(vaultSecrets.namespace, namespace))
  return rows.map((r) => r.key)
}

export async function listVaultNamespaces() {
  const rows = await db
    .selectDistinct({ namespace: vaultSecrets.namespace })
    .from(vaultSecrets)
  return rows.map((r) => r.namespace)
}

export async function getVaultSecret(namespace: string, key: string) {
  const rows = await db
    .select({ value: vaultSecrets.value })
    .from(vaultSecrets)
    .where(and(eq(vaultSecrets.namespace, namespace), eq(vaultSecrets.key, key)))
  return rows[0]?.value ?? null
}

export async function upsertVaultSecret(namespace: string, key: string, value: string) {
  await db
    .insert(vaultSecrets)
    .values({ namespace, key, value })
    .onConflictDoUpdate({
      target: [vaultSecrets.namespace, vaultSecrets.key],
      set: {
        value,
        updatedAt: new Date(),
      },
    })
}

export async function deleteVaultSecret(namespace: string, key: string) {
  const result = await db
    .delete(vaultSecrets)
    .where(and(eq(vaultSecrets.namespace, namespace), eq(vaultSecrets.key, key)))
    .returning({ id: vaultSecrets.id })
  return result.length > 0
}
