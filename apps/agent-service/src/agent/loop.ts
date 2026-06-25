/**
 * Agent Loop — The iterative tool-use loop at the core of Gatekeeper.
 *
 * Flow:
 * 1. User sends message
 * 2. Build conversation history + inject MCP tools
 * 3. Call Gemini
 * 4. If Gemini returns function calls:
 *    - For EACH function call:
 *      a. Build a ToolExecutionIntent
 *      b. Evaluate against PolicyEngine → ALLOW / BLOCK / REQUIRE_APPROVAL
 *      c. If ALLOW: execute via MCPManager, feed result back
 *      d. If BLOCK: feed "blocked by policy" back as function response
 *      e. If REQUIRE_APPROVAL: await ApprovalQueue Promise, then execute or block
 *    - Append all function responses to history
 *    - Loop back to step 3 (model may want to call more tools)
 * 5. If Gemini returns text (no function calls): return as final response
 *
 * SSE events are emitted at every step for real-time dashboard visualization.
 */

import type { Content, FunctionDeclaration } from "@google/genai"
import type { ToolExecutionIntent } from "@repo/types"
import type { PolicyEngine } from "@repo/policy-engine"
import { getAllPolicyRules, createToolIntent } from "@repo/db/queries"
import { GeminiClient } from "./gemini-client.js"
import { convertToGeminiTools } from "./tool-converter.js"
import type { MCPManager } from "../mcp/manager.js"
import type { ApprovalQueue } from "../approval/queue.js"
import { eventBus } from "../events/event-bus.js"

/** Maximum iterations to prevent infinite loops */
const MAX_ITERATIONS = 15


export interface AgentLoopResult {
  conversationId: string
  response: string
  tokenCount: number
}

export interface AgentLoopDeps {
  gemini: GeminiClient
  mcpManager: MCPManager
  policyEngine: PolicyEngine
  approvalQueue: ApprovalQueue
}

/**
 * Run the iterative agent loop for a single user message.
 *
 * @param message - The user's message text
 * @param conversationId - Unique conversation ID
 * @param existingHistory - Previous conversation history (Content[])
 * @param deps - Injected dependencies (Gemini, MCP, PolicyEngine, ApprovalQueue)
 * @returns The final text response and total tokens consumed
 */
export async function runAgentLoop(
  message: string,
  conversationId: string,
  existingHistory: Content[],
  deps: AgentLoopDeps
): Promise<AgentLoopResult> {
  const { gemini, mcpManager, policyEngine, approvalQueue } = deps

  const history: Content[] = [
    ...existingHistory,
    GeminiClient.userMessage(message),
  ]

  const rawTools = mcpManager.getGeminiFunctionDeclarations()
  const tools = convertToGeminiTools(rawTools) as FunctionDeclaration[]

  let totalTokens = 0
  let iteration = 0

  const dbRules = await getAllPolicyRules()
  policyEngine.reloadRules(dbRules)

  eventBus.emitSSE("thinking", {}, conversationId)

  while (iteration < MAX_ITERATIONS) {
    iteration++

    const response = await gemini.generateContent(history, tools)

    const iterationTokens = GeminiClient.extractTokenCount(response)
    totalTokens += iterationTokens

    const functionCalls = GeminiClient.extractFunctionCalls(response)

    if (!functionCalls || functionCalls.length === 0) {
      const text = GeminiClient.extractText(response) ?? "I'm sorry, I couldn't generate a response."

      eventBus.emitSSE("assistant_message", { content: text }, conversationId)

      return {
        conversationId,
        response: text,
        tokenCount: totalTokens,
      }
    }

    history.push(GeminiClient.modelFunctionCallMessage(functionCalls))

    for (const fc of functionCalls) {
      const toolName = fc.name ?? "unknown"
      const args = fc.args ?? {}
      const serverName = mcpManager.getServerForTool(toolName) ?? "unknown"

      eventBus.emitSSE(
        "tool_call_intent",
        { toolName, serverName, arguments: args },
        conversationId
      )

      const intent: ToolExecutionIntent = {
        conversationId,
        toolName,
        mcpServer: serverName,
        arguments: args,
        timestamp: new Date(),
      }

      const decision = policyEngine.evaluate(intent)

      let functionResponseContent: Record<string, unknown>

      switch (decision.action) {
        case "ALLOW": {
          await createToolIntent({
            conversationId,
            toolName,
            mcpServer: serverName,
            arguments: args,
            decision: "ALLOW",
            matchedRuleId: decision.ruleId ?? null,
          })

          try {
            const result = await mcpManager.executeTool(toolName, args)

            const resultText = extractMCPResultText(result.content)

            functionResponseContent = {
              output: resultText,
            }

            eventBus.emitSSE(
              "tool_call_result",
              {
                toolName,
                serverName,
                result: resultText,
                decision: "ALLOW" as const,
              },
              conversationId
            )
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error)
            functionResponseContent = {
              error: `Tool execution failed: ${errorMsg}`,
            }

            eventBus.emitSSE(
              "error",
              { message: `Tool "${toolName}" failed: ${errorMsg}` },
              conversationId
            )
          }
          break
        }

        case "BLOCK": {
          await createToolIntent({
            conversationId,
            toolName,
            mcpServer: serverName,
            arguments: args,
            decision: "BLOCK",
            matchedRuleId: decision.ruleId ?? null,
          })

          functionResponseContent = {
            error: `Blocked by policy: ${decision.reason ?? "This tool is not allowed."}`,
          }

          eventBus.emitSSE(
            "tool_call_blocked",
            {
              toolName,
              serverName,
              reason: decision.reason ?? "Blocked by policy",
              ruleId: decision.ruleId,
            },
            conversationId
          )
          break
        }

        case "REQUIRE_APPROVAL": {
          try {
            const approvalDecision = await approvalQueue.createPending(
              intent,
              decision.timeoutMs,
              decision.ruleId ?? null
            )

            if (approvalDecision === "APPROVED") {
              // Execute the tool
              try {
                const result = await mcpManager.executeTool(toolName, args)
                const resultText = extractMCPResultText(result.content)

                functionResponseContent = {
                  output: resultText,
                }

                eventBus.emitSSE(
                  "tool_call_result",
                  {
                    toolName,
                    serverName,
                    result: resultText,
                    decision: "ALLOW" as const,
                  },
                  conversationId
                )
              } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error)
                functionResponseContent = {
                  error: `Tool execution failed after approval: ${errorMsg}`,
                }
              }
            } else {
              // Denied or timed out
              functionResponseContent = {
                error: `Tool call was ${approvalDecision === "DENIED" ? "denied by an administrator" : "denied due to timeout"}.`,
              }

              eventBus.emitSSE(
                "tool_call_blocked",
                {
                  toolName,
                  serverName,
                  reason: "Denied by administrator or timed out",
                  ruleId: decision.ruleId,
                },
                conversationId
              )
            }
          } catch {
            functionResponseContent = {
              error: "Approval process failed. Tool call was not executed.",
            }
          }
          break
        }

        default: {
          functionResponseContent = { error: "Unknown policy decision" }
        }
      }

      // Add the function response to history for the next iteration
      history.push(
        GeminiClient.functionResponseMessage(toolName, functionResponseContent, fc.id)
      )
    }
  }

  const fallbackMessage =
    "I've reached the maximum number of tool call iterations. Here's what I've gathered so far based on the results above."

  eventBus.emitSSE("assistant_message", { content: fallbackMessage }, conversationId)

  return {
    conversationId,
    response: fallbackMessage,
    tokenCount: totalTokens,
  }
}

/**
 * Extract readable text from an MCP tool result.
 * MCP results come as `content: Array<{ type: "text", text: string }>`.
 */
function extractMCPResultText(content: unknown): string {
  if (typeof content === "string") return content

  if (Array.isArray(content)) {
    return content
      .map((item: unknown) => {
        if (typeof item === "object" && item !== null && "text" in item) {
          return String((item as { text: unknown }).text)
        }
        if (typeof item === "string") return item
        return JSON.stringify(item)
      })
      .join("\n")
  }

  return JSON.stringify(content)
}
