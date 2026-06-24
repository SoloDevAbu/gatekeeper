import type { Content } from "@google/genai"

export const conversations = new Map<string, Content[]>()

export const rules: Array<{
  id: string
  type: string
  toolPattern: string
  namespacePattern: string | null
  action: string
  config: Record<string, unknown>
  enabled: boolean
  priority: number
  createdAt: string
  updatedAt: string
}> = []
