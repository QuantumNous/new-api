import { useEffect, useRef, useState } from 'react'
import { createFromReadableStream } from '@tanstack/react-start/rsc'
import { streamComments } from '~/e-Commerce/server-functions'

interface CommentEntry {
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

const MAX_COMMENTS = 10

export function StreamingComments() {
  const [comments, setComments] = useState<Array<CommentEntry>>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [, setTick] = useState(0) // Force re-render for relative time updates
  const hasStartedRef = useRef(false)

  // Update relative times every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Auto-start streaming on mount
  useEffect(() => {
    if (hasStartedRef.current) return
    hasStartedRef.current = true

    const startStream = async () => {
      setIsStreaming(true)

      try {
        for await (const { id, payload } of await streamComments()) {
          // Decode the RSC payload
          const stream = payloadToStream(payload)
          const element = await createFromReadableStream(stream)

          const entry: CommentEntry = {
            id,
            element: element as React.ReactNode,
            receivedAt: Date.now(),
          }

          // Add to comments, keeping newest at top, capped at MAX_COMMENTS
          setComments((prev) => [entry, ...prev].slice(0, MAX_COMMENTS))
        }
      } catch (error) {
        console.error('Streaming error:', error)
      } finally {
        setIsStreaming(false)
      }
    }

    startStream()
  }, [])

  return (
    <div className="border-6 border-dashed border-green-500 rounded-lg p-4 space-y-4">
      {isStreaming && (
        <div className="flex items-center gap-2 text-purple-600">
          <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-sm font-medium">Streaming live reviews...</span>
        </div>
      )}

      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse" />
              <span>Loading reviews...</span>
            </div>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="relative">
              {/* The RSC element */}
              {comment.element}
              {/* Client-side relative time */}
              <div className="absolute bottom-2 right-3 text-xs text-white/70 font-mono">
                received {formatRelativeTime(comment.receivedAt)}
              </div>
            </div>
          ))
        )}
      </div>

      {comments.length > 0 && (
        <div className="text-xs text-gray-500 text-center">
          Showing {comments.length} of {MAX_COMMENTS} reviews (newest first)
        </div>
      )}
    </div>
  )
}
