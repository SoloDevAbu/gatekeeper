/**
 * VaultStore — In-memory secret storage with namespace isolation.
 *
 * Structure: Map<namespace, Map<key, value>>
 *
 * Pre-seeded with realistic sample data across dev/staging/prod namespaces
 * to make the demo compelling and the guardrail scenarios obvious.
 */

import crypto from "node:crypto"

export class VaultStore {
  private store: Map<string, Map<string, string>>

  constructor() {
    this.store = new Map()
    this.seed()
  }

  /**
   * Pre-seed with realistic secrets across multiple namespaces.
   * This makes the demo powerful — you can show:
   *   - "list_secrets dev" → works (no guardrails triggered)
   *   - "get_secret prod/stripe_key" → blocked by namespace restriction
   *   - "delete_secret prod/db_password" → blocked by tool block rule
   */
  private seed(): void {
    this.store.set(
      "dev",
      new Map([
        ["db_password", "dev-pass-f8a3b1c2"],
        ["api_key", "dev-ak-7d2e9f4a"],
        ["jwt_secret", "dev-jwt-b3c8d5e1"],
        ["redis_url", "redis://localhost:6379"],
      ])
    )

    this.store.set(
      "staging",
      new Map([
        ["db_password", "stg-pass-a1b2c3d4"],
        ["api_key", "stg-ak-e5f6g7h8"],
        ["jwt_secret", "stg-jwt-i9j0k1l2"],
        ["stripe_key", "sk_test_stg_4eC39HqLyjWDarjtT1zdp7dc"],
      ])
    )

    this.store.set(
      "prod",
      new Map([
        ["db_password", "prod-pass-HIGHLY-SENSITIVE"],
        ["stripe_key", "sk_live_HIGHLY-SENSITIVE-PROD-KEY"],
        ["jwt_secret", "prod-jwt-HIGHLY-SENSITIVE"],
        ["openai_key", "sk-prod-HIGHLY-SENSITIVE-AI-KEY"],
        ["webhook_secret", "whsec_prod-HIGHLY-SENSITIVE"],
      ])
    )
  }

  // ─── Operations ─────────────────────────────────────────────────────────

  /** List all secret keys in a namespace (values are NOT returned). */
  listKeys(namespace: string): string[] {
    const ns = this.store.get(namespace)
    if (!ns) return []
    return Array.from(ns.keys())
  }

  /** Get all available namespaces. */
  listNamespaces(): string[] {
    return Array.from(this.store.keys())
  }

  /** Retrieve a secret's value. Returns null if not found. */
  getSecret(namespace: string, key: string): string | null {
    const ns = this.store.get(namespace)
    if (!ns) return null
    return ns.get(key) ?? null
  }

  /** Create or update a secret. Creates the namespace if it doesn't exist. */
  setSecret(namespace: string, key: string, value: string): void {
    let ns = this.store.get(namespace)
    if (!ns) {
      ns = new Map()
      this.store.set(namespace, ns)
    }
    ns.set(key, value)
  }

  /** Delete a secret. Returns true if the secret existed and was deleted. */
  deleteSecret(namespace: string, key: string): boolean {
    const ns = this.store.get(namespace)
    if (!ns) return false
    return ns.delete(key)
  }

  /**
   * Rotate a secret — generate a new cryptographically random value.
   * Returns the new value. Throws if the secret doesn't exist.
   */
  rotateSecret(namespace: string, key: string, length: number = 32): string {
    const ns = this.store.get(namespace)
    if (!ns || !ns.has(key)) {
      throw new Error(
        `Secret "${key}" not found in namespace "${namespace}". Cannot rotate a non-existent secret.`
      )
    }

    const newValue = crypto.randomBytes(length).toString("hex").slice(0, length)
    ns.set(key, newValue)
    return newValue
  }
}
