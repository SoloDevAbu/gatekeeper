/**
 * Application configuration — loaded from environment variables.
 */

import dotenv from "dotenv"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env from monorepo root
dotenv.config({ path: path.resolve(__dirname, "../../../.env") })

export const config = {
  /** Server port */
  port: parseInt(process.env["PORT"] ?? "3001", 10),

  /** Server host */
  host: process.env["HOST"] ?? "0.0.0.0",

  /** Gemini API key */
  geminiApiKey: process.env["GEMINI_API_KEY"] ?? "",

  /** Gemini model to use */
  geminiModel: process.env["GEMINI_MODEL"] ?? "gemini-2.5-flash",

  /** Database URL */
  databaseUrl: process.env["DATABASE_URL"] ?? "",

  /** Frontend origin for CORS */
  frontendUrl: process.env["FRONTEND_URL"] ?? "http://localhost:3000",

  /** Default approval timeout in ms (5 minutes) */
  approvalTimeoutMs: parseInt(process.env["APPROVAL_TIMEOUT_MS"] ?? "300000", 10),
} as const

/** Validate required config on startup */
export function validateConfig(): void {
  if (!config.geminiApiKey) {
    console.warn("[config] WARNING: GEMINI_API_KEY is not set. LLM calls will fail.")
  }
  if (!config.databaseUrl) {
    console.warn("[config] WARNING: DATABASE_URL is not set. DB operations will fail.")
  }
}
