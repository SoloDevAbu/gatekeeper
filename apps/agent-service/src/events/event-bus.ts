/**
 * EventBus — Central nervous system of the agent service.
 *
 * A typed EventEmitter that both SSE endpoints and internal components
 * (PolicyEngine, ApprovalQueue) subscribe to. Single source of truth
 * for all real-time events.
 *
 * Usage:
 *   eventBus.emitSSE("tool_call_intent", { toolName, ... }, conversationId)
 *   eventBus.on("approval_requested", (event) => ...)
 *   eventBus.off("approval_requested", handler)
 */

import { EventEmitter } from "node:events"
import type {
  SSEEventType,
  SSEEvent,
  ThinkingEventData,
  AssistantMessageEventData,
  ToolCallIntentEventData,
  ToolCallResultEventData,
  ToolCallBlockedEventData,
  ApprovalRequestedEventData,
  ApprovalDecidedEventData,
  PolicyChangedEventData,
  ErrorEventData,
} from "@repo/types"

interface EventDataMap {
  thinking: ThinkingEventData
  assistant_message: AssistantMessageEventData
  tool_call_intent: ToolCallIntentEventData
  tool_call_result: ToolCallResultEventData
  tool_call_blocked: ToolCallBlockedEventData
  approval_requested: ApprovalRequestedEventData
  approval_decided: ApprovalDecidedEventData
  policy_changed: PolicyChangedEventData
  error: ErrorEventData
}

class TypedEventBus extends EventEmitter {
  constructor() {
    super()
    // 100 simultaneous SSE connections per event type is a safe upper bound
    this.setMaxListeners(100)
  }

  /**
   * Emit a typed SSE event. Wraps the data in the SSEEvent envelope and
   * emits on the matching event name.
   */
  emitSSE<K extends SSEEventType>(
    type: K,
    data: EventDataMap[K],
    conversationId?: string
  ): void {
    const event: SSEEvent<EventDataMap[K]> = {
      type,
      conversationId,
      timestamp: new Date().toISOString(),
      data,
    }
    this.emit(type, event)
  }

  /**
   * Subscribe to a typed event. The handler receives the full SSEEvent envelope.
   */
  on(event: SSEEventType, listener: (event: SSEEvent) => void): this
  on(event: string | symbol, listener: (...args: unknown[]) => void): this
  on(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(event, listener)
  }

  /**
   * Unsubscribe from a typed event.
   */
  off(event: SSEEventType, listener: (event: SSEEvent) => void): this
  off(event: string | symbol, listener: (...args: unknown[]) => void): this
  off(event: string | symbol, listener: (...args: any[]) => void): this {
    return super.off(event, listener)
  }
}

export const eventBus = new TypedEventBus()
