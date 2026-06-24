"use client"

import { useEffect, useState } from "react"

export function useSSE<T>(url: string | null) {
  const [events, setEvents] = useState<T[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!url) return

    const source = new EventSource(url)

    source.onopen = () => setIsConnected(true)
    source.onmessage = (e) => {
      // The server sometimes sends ": heartbeat\n\n" but those are handled by EventSource internally.
      // We only parse actual data messages.
      try {
        const event = JSON.parse(e.data) as T
        setEvents((prev) => [...prev, event])
      } catch (err) {
        console.error("Failed to parse SSE message:", err, e.data)
      }
    }
    source.onerror = () => setIsConnected(false)
    // EventSource auto-reconnects natively when connection is lost

    return () => {
      source.close()
      setIsConnected(false)
    }
  }, [url])

  return { events, isConnected, setEvents }
}
