/**
 * Convert MCP tool schemas to Gemini FunctionDeclaration format.
 *
 * The MCP SDK returns tools with JSON Schema `inputSchema`.
 * Gemini expects `parameters` in a specific OpenAPI-like format.
 * This module handles the translation.
 */

import type { GeminiFunctionDeclaration } from "../mcp/manager.js"

/**
 * Sanitize the inputSchema for Gemini compatibility.
 *
 * Gemini FunctionDeclarations expect:
 * - `type: "object"` at the top level
 * - `properties` object
 * - No `$schema`, `additionalProperties`, or MCP-specific keys
 */
export function sanitizeSchemaForGemini(
  inputSchema: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!inputSchema || typeof inputSchema !== "object") {
    return undefined
  }

  const schema = { ...inputSchema }

  // Remove keys Gemini doesn't understand
  delete schema["$schema"]
  delete schema["additionalProperties"]

  // Ensure type is "object" (Gemini requirement for function params)
  if (!schema["type"]) {
    schema["type"] = "object"
  }
  const props = schema["properties"]
  if (!props || typeof props !== "object" || Object.keys(props).length === 0) {
    return undefined
  }

  return schema
}

/**
 * Convert an array of Gemini function declarations, sanitizing schemas.
 */
export function convertToGeminiTools(
  declarations: GeminiFunctionDeclaration[]
): GeminiFunctionDeclaration[] {
  return declarations.map((decl) => ({
    name: decl.name,
    description: decl.description,
    parameters: decl.parameters
      ? sanitizeSchemaForGemini(decl.parameters)
      : undefined,
  }))
}
