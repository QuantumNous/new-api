import { Await, createFileRoute } from '@tanstack/react-router'
import { Suspense, useEffect, useRef, useState } from 'react'

export const Route = createFileRoute('/stream')({
  component: StreamRoute,
  loader() {
    return {
      // A promise that resolves after a short delay
      promise: new Promise<string>((resolve) =>
        setTimeout(() => resolve('promise-resolved'), 150),
      ),
      // A ReadableStream that emits chunks over time
      stream: new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 200))
            controller.enqueue(`chunk-${i}`)
          }
          controller.close()
        },
      }),
    }
  },
})

const decoder = new TextDecoder('utf-8')

function StreamRoute() {
  const { promise, stream } = Route.useLoaderData()
  const [streamData, setStreamData] = useState<Array<string>>([])
  const [streamComplete, setStreamComplete] = useState(false)
  const readerRef = useRef<ReadableStreamDefaultReader | null>(null)
  const streamRef = useRef<ReadableStream | null>(null)

  useEffect(() => {
    // If we're already reading this exact stream, don't start again
    if (streamRef.current === stream && readerRef.current) {
      return
    }

    // Reset state for a new stream
    if (streamRef.current !== stream) {
      setStreamData([])
      setStreamComplete(false)
      streamRef.current = stream
    }

    // Check if stream is already locked (from a previous render)
    if (stream.locked) {
      return
    }

    async function fetchStream() {
      try {
        const reader = stream.getReader()
        readerRef.current = reader
        let chunk

        while (!(chunk = await reader.read()).done) {
          let value = chunk.value
          if (typeof value !== 'string') {
            value = decoder.decode(value, { stream: !chunk.done })
          }
          setStreamData((prev) => [...prev, value])
        }
        setStreamComplete(true)
      } catch (e) {
        // Stream was cancelled or errored, ignore
        if (!(e instanceof TypeError && String(e).includes('cancelled'))) {
          console.error('Stream error:', e)
        }
      }
    }

    fetchStream()

    return () => {
      // Cancel the reader on cleanup
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {})
        readerRef.current = null
      }
    }
  }, [stream])

  return (
    <div style={{ padding: '20px' }}>
      <h2>ReadableStream Test</h2>

      {/* Promise data */}
      <Suspense
        fallback={<div data-testid="promise-loading">Loading promise...</div>}
      >
        <Await
          promise={promise}
          children={(data) => <div data-testid="promise-data">{data}</div>}
        />
      </Suspense>

      {/* Stream data */}
      <div data-testid="stream-container">
        <h3>Stream chunks:</h3>
        <div data-testid="stream-data">
          {streamData.map((chunk, i) => (
            <div key={i} data-testid={`stream-chunk-${i}`}>
              {chunk}
            </div>
          ))}
        </div>
        {streamComplete && (
          <div data-testid="stream-complete">Stream complete!</div>
        )}
      </div>
    </div>
  )
}
