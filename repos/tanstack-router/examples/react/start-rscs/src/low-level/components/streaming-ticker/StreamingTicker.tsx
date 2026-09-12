import { useCallback, useEffect, useRef, useState } from 'react'
import { createFromReadableStream } from '@tanstack/react-start/rsc'

import { streamTickerRscs } from './server-functions'

interface TickerEntry {
  id: number
  element: React.ReactNode
  receivedAt: number
}

// Helper to convert string payload back to ReadableStream
function payloadToStream(payload: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload))
      controller.close()
    },
  })
}

// Format relative time
function formatRelativeTime(receivedAt: number): string {
  const seconds = Math.floor((Date.now() - receivedAt) / 1000)
  if (seconds < 1) return 'just now'
  if (seconds === 1) return '1 second ago'
  return `${seconds} seconds ago`
}

export function StreamingTicker() {
  const [items, setItems] = useState<Array<TickerEntry>>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [, setTick] = useState(0) // Force re-render for relative time updates
  const abortRef = useRef(false)

  // Update relative times every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const startStream = useCallback(async () => {
    setIsStreaming(true)
    abortRef.current = false
    setItems([])

    try {
      for await (const { id, payload } of await streamTickerRscs()) {
        if (abortRef.current) break

        // Decode the RSC payload
        const stream = payloadToStream(payload)
        const element = await createFromReadableStream(stream)

        const entry: TickerEntry = {
          id,
          element: element as React.ReactNode,
          receivedAt: Date.now(),
        }

        // Add to items, keeping only last 10
        setItems((prev) => [entry, ...prev].slice(0, 10))
      }
    } catch (error) {
      console.error('Streaming error:', error)
    } finally {
      setIsStreaming(false)
    }
  }, [])

  const stopStream = useCallback(() => {
    abortRef.current = true
    setIsStreaming(false)
  }, [])

  const clearItems = useCallback(() => {
    abortRef.current = true
    setIsStreaming(false)
    setItems([])
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        {!isStreaming ? (
          <button
            onClick={startStream}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Start Stream
          </button>
        ) : (
          <button
            onClick={stopStream}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
          >
            Stop
          </button>
        )}
        <button
          onClick={clearItems}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
        >
          Clear
        </button>
      </div>

      {isStreaming && (
        <div className="flex items-center gap-2 text-purple-600">
          <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-sm font-medium">Streaming RSCs...</span>
        </div>
      )}

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            Click "Start Stream" to begin receiving RSC payloads
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="relative">
              {/* The RSC element */}
              {item.element}
              {/* Client-side relative time */}
              <div className="absolute bottom-1 right-2 text-xs text-white/70 font-mono">
                received {formatRelativeTime(item.receivedAt)}
              </div>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="text-xs text-gray-500 text-center">
          Showing {items.length} of last 10 items (newest first)
        </div>
      )}

      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
        <strong>How it works:</strong> Each ticker item is a React Server
        Component rendered on the server with{' '}
        <code>renderToReadableStream</code>, streamed as a Flight payload, and
        decoded on the client with <code>createFromReadableStream</code>. The
        "received X seconds ago" text updates live on the client.
      </div>
    </div>
  )
}
