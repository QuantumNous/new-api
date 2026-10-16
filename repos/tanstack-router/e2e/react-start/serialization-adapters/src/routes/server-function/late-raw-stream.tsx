import { createFileRoute } from '@tanstack/react-router'
import { RawStream, createServerFn } from '@tanstack/react-start'
import { Suspense, use, useEffect, useState } from 'react'

/**
 * Helper to create a readable stream of text chunks
 */
function createTextStream(chunks: Array<string>, delayMs = 50) {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder()
      for (const chunk of chunks) {
        await new Promise((r) => setTimeout(r, delayMs))
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

/**
 * Server function that returns a Promise<RawStream> - tests late stream registration.
 * The RawStream is discovered after the initial synchronous serialization pass.
 */
const getLateRawStream = createServerFn().handler(async () => {
  // Delay before creating the RawStream
  const delayedStream = new Promise<RawStream>((resolve) => {
    setTimeout(() => {
      resolve(new RawStream(createTextStream(['chunk1', '-chunk2', '-chunk3'])))
    }, 100)
  })

  return {
    immediate: 'immediate-data',
    timestamp: Date.now(),
    stream: delayedStream,
  }
})

/**
 * Server function that returns multiple late RawStreams with different delays.
 */
const getMultipleLateRawStreams = createServerFn().handler(async () => {
  const stream1 = new Promise<RawStream>((resolve) => {
    setTimeout(() => {
      resolve(new RawStream(createTextStream(['stream1-a', '-stream1-b'])))
    }, 50)
  })

  const stream2 = new Promise<RawStream>((resolve) => {
    setTimeout(() => {
      resolve(new RawStream(createTextStream(['stream2-a', '-stream2-b'])))
    }, 150)
  })

  return {
    timestamp: Date.now(),
    stream1,
    stream2,
  }
})

/**
 * Server function that returns a mix of immediate and late RawStreams.
 */
const getMixedRawStreams = createServerFn().handler(async () => {
  // Immediate stream - discovered during initial serialization
  const immediateStream = new RawStream(
    createTextStream(['immediate-a', '-immediate-b']),
  )

  // Late stream - discovered after serialization starts
  const lateStream = new Promise<RawStream>((resolve) => {
    setTimeout(() => {
      resolve(new RawStream(createTextStream(['late-a', '-late-b'])))
    }, 100)
  })

  return {
    timestamp: Date.now(),
    immediateStream,
    lateStream,
  }
})

export const Route = createFileRoute('/server-function/late-raw-stream')({
  component: RouteComponent,
})

function StreamReader({
  stream,
  testId,
}: {
  stream: ReadableStream<Uint8Array> | RawStream
  testId: string
}) {
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    const actualStream = stream instanceof RawStream ? stream.stream : stream
    const reader = actualStream.getReader()
    const chunks: Array<string> = []
    const decoder = new TextDecoder()

    const readChunks = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(decoder.decode(value))
        }
        setResult(chunks.join(''))
      } catch (error) {
        setResult(`error: ${error}`)
      }
    }
    readChunks()
  }, [stream])

  return (
    <div data-testid={testId}>{result === null ? 'reading...' : result}</div>
  )
}

function LateStreamResolver({
  streamPromise,
  testId,
}: {
  streamPromise: Promise<ReadableStream<Uint8Array> | RawStream>
  testId: string
}) {
  const stream = use(streamPromise)
  return <StreamReader stream={stream} testId={testId} />
}

function LateStreamResult({
  resultPromise,
}: {
  resultPromise: Promise<Awaited<ReturnType<typeof getLateRawStream>>>
}) {
  const result = use(resultPromise)

  return (
    <div>
      <div data-testid="late-immediate">{result.immediate}</div>
      <div data-testid="late-timestamp">{result.timestamp}</div>
      <Suspense fallback={<div>loading late stream...</div>}>
        <LateStreamResolver
          streamPromise={result.stream}
          testId="late-stream-result"
        />
      </Suspense>
    </div>
  )
}

function MultiStreamResult({
  resultPromise,
}: {
  resultPromise: Promise<Awaited<ReturnType<typeof getMultipleLateRawStreams>>>
}) {
  const result = use(resultPromise)

  return (
    <div>
      <div data-testid="multi-timestamp">{result.timestamp}</div>
      <Suspense fallback={<div>loading stream1...</div>}>
        <LateStreamResolver
          streamPromise={result.stream1}
          testId="multi-stream1-result"
        />
      </Suspense>
      <Suspense fallback={<div>loading stream2...</div>}>
        <LateStreamResolver
          streamPromise={result.stream2}
          testId="multi-stream2-result"
        />
      </Suspense>
    </div>
  )
}

function MixedStreamResult({
  resultPromise,
}: {
  resultPromise: Promise<Awaited<ReturnType<typeof getMixedRawStreams>>>
}) {
  const result = use(resultPromise)

  return (
    <div>
      <div data-testid="mixed-timestamp">{result.timestamp}</div>
      <StreamReader
        stream={result.immediateStream}
        testId="mixed-immediate-result"
      />
      <Suspense fallback={<div>loading late...</div>}>
        <LateStreamResolver
          streamPromise={result.lateStream}
          testId="mixed-late-result"
        />
      </Suspense>
    </div>
  )
}

function RouteComponent() {
  const [lateResult, setLateResult] = useState<Promise<
    Awaited<ReturnType<typeof getLateRawStream>>
  > | null>(null)
  const [multiResult, setMultiResult] = useState<Promise<
    Awaited<ReturnType<typeof getMultipleLateRawStreams>>
  > | null>(null)
  const [mixedResult, setMixedResult] = useState<Promise<
    Awaited<ReturnType<typeof getMixedRawStreams>>
  > | null>(null)

  return (
    <div>
      <h1>Late RawStream Tests</h1>

      <section>
        <h2>Single Late Stream</h2>
        <button
          data-testid="late-trigger"
          onClick={() => setLateResult(getLateRawStream())}
        >
          Trigger Late Stream
        </button>
        {lateResult ? (
          <Suspense fallback={<div data-testid="late-loading">loading...</div>}>
            <LateStreamResult resultPromise={lateResult} />
          </Suspense>
        ) : (
          <div data-testid="late-waiting">waiting for trigger...</div>
        )}
      </section>

      <section>
        <h2>Multiple Late Streams</h2>
        <button
          data-testid="multi-trigger"
          onClick={() => setMultiResult(getMultipleLateRawStreams())}
        >
          Trigger Multiple Streams
        </button>
        {multiResult ? (
          <Suspense
            fallback={<div data-testid="multi-loading">loading...</div>}
          >
            <MultiStreamResult resultPromise={multiResult} />
          </Suspense>
        ) : (
          <div data-testid="multi-waiting">waiting for trigger...</div>
        )}
      </section>

      <section>
        <h2>Mixed Immediate + Late Streams</h2>
        <button
          data-testid="mixed-trigger"
          onClick={() => setMixedResult(getMixedRawStreams())}
        >
          Trigger Mixed Streams
        </button>
        {mixedResult ? (
          <Suspense
            fallback={<div data-testid="mixed-loading">loading...</div>}
          >
            <MixedStreamResult resultPromise={mixedResult} />
          </Suspense>
        ) : (
          <div data-testid="mixed-waiting">waiting for trigger...</div>
        )}
      </section>
    </div>
  )
}
