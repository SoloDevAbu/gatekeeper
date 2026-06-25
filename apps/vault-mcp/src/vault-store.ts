/**
 * VaultStore — Database-backed secret storage with namespace isolation.
 *
 * Uses Drizzle ORM to query the `vault_secrets` PostgreSQL table.
 * Each secret has: namespace, key, value, createdAt, updatedAt.
 *
 * Pre-seeds the DB with realistic sample data across dev/staging/prod
 * namespaces on first run (when table is empty).
 */

import crypto from "node:crypto"
import {
  countVaultSecrets,
  insertVaultSecrets,
  listVaultKeys,
  listVaultNamespaces,
  getVaultSecret,
  upsertVaultSecret,
  deleteVaultSecret,
} from "@repo/db/queries"

export class VaultStore {
  /**
   * Seed the database with sample secrets if the table is empty.
   * Safe to call on every startup — it's a no-op when data exists.
   */
  async seed(): Promise<void> {
    const count = await countVaultSecrets()
    if (count > 0) {
      console.error("[vault-store] Secrets already exist in DB, skipping seed")
      return
    }

    console.error("[vault-store] Seeding vault_secrets table with sample data...")

    await insertVaultSecrets([
      // ─── dev namespace ───
      { namespace: "dev", key: "db_password", value: "dev-pass-f8a3b1c2" },
      { namespace: "dev", key: "api_key", value: "dev-ak-7d2e9f4a" },
      { namespace: "dev", key: "jwt_secret", value: "dev-jwt-b3c8d5e1" },
      { namespace: "dev", key: "redis_url", value: "redis://localhost:6379" },

      // ─── staging namespace ───
      { namespace: "staging", key: "db_password", value: "stg-pass-a1b2c3d4" },
      { namespace: "staging", key: "api_key", value: "stg-ak-e5f6g7h8" },
      { namespace: "staging", key: "jwt_secret", value: "stg-jwt-i9j0k1l2" },
      { namespace: "staging", key: "stripe_key", value: "sk_test_stg_4eC39HqLyjWDarjtT1zdp7dc" },

      // ─── prod namespace ───
      { namespace: "prod", key: "db_password", value: "prod-pass-HIGHLY-SENSITIVE" },
      { namespace: "prod", key: "stripe_key", value: "sk_live_HIGHLY-SENSITIVE-PROD-KEY" },
      { namespace: "prod", key: "jwt_secret", value: "prod-jwt-HIGHLY-SENSITIVE" },
      { namespace: "prod", key: "openai_key", value: "sk-prod-HIGHLY-SENSITIVE-AI-KEY" },
      { namespace: "prod", key: "webhook_secret", value: "whsec_prod-HIGHLY-SENSITIVE" },
    ])

    console.error("[vault-store] Seed complete: dev (4), staging (4), prod (5)")
  }

  // ─── Operations ─────────────────────────────────────────────────────────

  /** List all secret keys in a namespace (values are NOT returned). */
  async listKeys(namespace: string): Promise<string[]> {
    return listVaultKeys(namespace)
  }

  /** Get all available namespaces. */
  async listNamespaces(): Promise<string[]> {
    return listVaultNamespaces()
  }

  /** Retrieve a secret's value. Returns null if not found. */
  async getSecret(namespace: string, key: string): Promise<string | null> {
    return getVaultSecret(namespace, key)
  }

  /** Create or update a secret. Creates the namespace implicitly. */
  async setSecret(namespace: string, key: string, value: string): Promise<void> {
    await upsertVaultSecret(namespace, key, value)
  }

  /** Delete a secret. Returns true if the secret existed and was deleted. */
  async deleteSecret(namespace: string, key: string): Promise<boolean> {
    return deleteVaultSecret(namespace, key)
  }

  /**
   * Rotate a secret — generate a new cryptographically random value.
   * Returns the new value. Throws if the secret doesn't exist.
   */
  async rotateSecret(namespace: string, key: string, length: number = 32): Promise<string> {
    const existing = await this.getSecret(namespace, key)

    if (existing === null) {
      throw new Error(
        `Secret "${key}" not found in namespace "${namespace}". Cannot rotate a non-existent secret.`
      )
    }

    const newValue = crypto.randomBytes(length).toString("hex").slice(0, length)
    await this.setSecret(namespace, key, newValue)
    return newValue
  }
}
