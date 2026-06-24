/**
 * Pattern matching utility for tool names and namespace patterns.
 *
 * Supports:
 *   - Exact match:  "delete_secret" matches "delete_secret"
 *   - Wildcard:     "*" matches anything
 *   - Glob prefix:  "get_*" matches "get_secret", "get_config"
 *   - Glob suffix:  "*_secret" matches "get_secret", "delete_secret"
 *   - Multi-glob:   "prod/*" matches "prod/stripe", "prod/db"
 */

/**
 * Test if a glob-like pattern matches a given value.
 *
 * @param pattern - The pattern to match against (e.g. "delete_*", "*", "prod/*")
 * @param value - The value to test (e.g. "delete_secret", "prod/stripe")
 * @returns true if the pattern matches the value
 *
 * @example
 * matchPattern("delete_secret", "delete_secret") // true
 * matchPattern("*", "anything")                   // true
 * matchPattern("get_*", "get_secret")             // true
 * matchPattern("get_*", "set_secret")             // false
 * matchPattern("prod/*", "prod/stripe")           // true
 * matchPattern("prod/*", "dev/stripe")            // false
 */
export function matchPattern(pattern: string, value: string): boolean {
  // Exact match (fast path)
  if (pattern === value) return true

  // Universal wildcard
  if (pattern === "*") return true

  // Convert glob pattern to regex:
  //   - Escape regex special chars (except *)
  //   - Replace * with .*
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
  const regexStr = "^" + escaped.replace(/\*/g, ".*") + "$"

  try {
    const regex = new RegExp(regexStr)
    return regex.test(value)
  } catch {
    // If the pattern produces an invalid regex, fall back to exact match
    return pattern === value
  }
}

/**
 * Calculate specificity of a pattern — fewer wildcards = more specific.
 * Used for conflict resolution when two rules match at the same priority.
 *
 * @returns Number of wildcard characters. 0 = most specific (exact match).
 */
export function patternSpecificity(pattern: string): number {
  return (pattern.match(/\*/g) || []).length
}
