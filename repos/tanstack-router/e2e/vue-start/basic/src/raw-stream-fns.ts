import { RawStream, createServerFn } from '@tanstack/vue-start'

// Helper to create a delayed Uint8Array stream
function createDelayedStream(
  chunks: Array<Uint8Array>,
  delayMs: number,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

// Helper to create a stream with variable delays per chunk
// Each entry is [chunk, delayBeforeMs] - delay happens BEFORE enqueueing the chunk
function createVariableDelayStream(
  chunksWithDelays: Array<[Uint8Array, number]>,
): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const [chunk, delayMs] of chunksWithDelays) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        controller.enqueue(chunk)
      }
      controller.close()
    },
  })
}

// Helper to encode text to Uint8Array
function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

// Export helpers for use in components and SSR routes
export { encode, createDelayedStream, concatBytes }

// Expected data for hint tests - defined here for both server and client verification
// Test 7: Text hint with pure text
export const TEST7_CHUNKS = [
  encode('Hello, '),
  encode('World! '),
  encode('This is text.'),
]
export const TEST7_EXPECTED = concatBytes(TEST7_CHUNKS)

// Test 8: Text hint with pure binary (invalid UTF-8)
export const TEST8_CHUNKS = [
  new Uint8Array([0xff, 0xfe, 0x00, 0x01, 0x80, 0x90]),
  new Uint8Array([0xa0, 0xb0, 0xc0, 0xd0, 0xe0, 0xf0]),
]
export const TEST8_EXPECTED = concatBytes(TEST8_CHUNKS)

// Test 9: Text hint with mixed content
export const TEST9_CHUNKS = [
  encode('Valid UTF-8 text'),
  new Uint8Array([0xff, 0xfe, 0x80, 0x90]), // Invalid UTF-8
  encode(' More text'),
]
export const TEST9_EXPECTED = concatBytes(TEST9_CHUNKS)

// Test 10: Binary hint with text data
export const TEST10_CHUNKS = [encode('This is text but using binary hint')]
export const TEST10_EXPECTED = concatBytes(TEST10_CHUNKS)

// Test 11: Binary hint with pure binary
export const TEST11_CHUNKS = [
  new Uint8Array([0x00, 0x01, 0x02, 0xff, 0xfe, 0xfd]),
]
export const TEST11_EXPECTED = concatBytes(TEST11_CHUNKS)

// Helper to concatenate byte arrays
function concatBytes(chunks: Array<Uint8Array>): Uint8Array {
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}

// Test 1: Simple single raw stream
export const singleRawStreamFn = createServerFn().handler(async () => {
  const stream = createDelayedStream(
    [encode('chunk1'), encode('chunk2'), encode('chunk3')],
    50,
  )
  return {
    message: 'Single stream test',
    data: new RawStream(stream),
  }
})

// Test 2: Multiple raw streams
export const multipleRawStreamsFn = createServerFn().handler(async () => {
  const stream1 = createDelayedStream(
    [encode('stream1-a'), encode('stream1-b')],
    30,
  )
  const stream2 = createDelayedStream(
    [encode('stream2-a'), encode('stream2-b')],
    50,
  )
  return {
    message: 'Multiple streams test',
    first: new RawStream(stream1),
    second: new RawStream(stream2),
  }
})

// Test 3: JSON streaming ends before raw stream
export const jsonEndsFirstFn = createServerFn().handler(async () => {
  // Slow raw stream (takes 500ms total)
  const slowStream = createDelayedStream(
    [encode('slow-1'), encode('slow-2'), encode('slow-3'), encode('slow-4')],
    125,
  )
  return {
    message: 'JSON ends first test',
    timestamp: Date.now(),
    slowData: new RawStream(slowStream),
  }
})

// Test 4: Raw stream ends before JSON streaming (fast stream, deferred JSON)
export const rawEndsFirstFn = createServerFn().handler(async () => {
  // Fast raw stream (completes quickly)
  const fastStream = createDelayedStream([encode('fast-done')], 10)

  // Deferred promise - NOT awaited, so it streams as deferred JSON
  const deferredData = new Promise<string>((resolve) =>
    setTimeout(() => resolve('deferred-json-data'), 200),
  )

  return {
    message: 'Raw ends first test',
    deferredData,
    fastData: new RawStream(fastStream),
  }
})

// Test 5: Large binary data
export const largeBinaryFn = createServerFn().handler(async () => {
  // Create 1KB chunks
  const chunk = new Uint8Array(1024)
  for (let i = 0; i < chunk.length; i++) {
    chunk[i] = i % 256
  }

  const stream = createDelayedStream([chunk, chunk, chunk], 20)

  return {
    message: 'Large binary test',
    size: 3072,
    binary: new RawStream(stream),
  }
})

// Test 6: Mixed streaming (promise + raw stream)
export const mixedStreamingFn = createServerFn().handler(async () => {
  const rawStream = createDelayedStream(
    [encode('mixed-raw-1'), encode('mixed-raw-2')],
    50,
  )

  return {
    immediate: 'immediate-value',
    deferred: new Promise<string>((resolve) =>
      setTimeout(() => resolve('deferred-value'), 100),
    ),
    raw: new RawStream(rawStream),
  }
})

// Test 7: Text hint with pure text data (should use UTF-8 encoding)
export const textHintPureTextFn = createServerFn().handler(async () => {
  const stream = createDelayedStream(TEST7_CHUNKS, 30)
  return {
    message: 'Text hint with pure text',
    data: new RawStream(stream, { hint: 'text' }),
  }
})

// Test 8: Text hint with pure binary data (should fallback to base64)
export const textHintPureBinaryFn = createServerFn().handler(async () => {
  const stream = createDelayedStream(TEST8_CHUNKS, 30)
  return {
    message: 'Text hint with pure binary',
    data: new RawStream(stream, { hint: 'text' }),
  }
})

// Test 9: Text hint with mixed content (some UTF-8, some binary)
export const textHintMixedFn = createServerFn().handler(async () => {
  const stream = createDelayedStream(TEST9_CHUNKS, 30)
  return {
    message: 'Text hint with mixed content',
    data: new RawStream(stream, { hint: 'text' }),
  }
})

// Test 10: Binary hint with text data (should still use base64)
export const binaryHintTextFn = createServerFn().handler(async () => {
  const stream = createDelayedStream(TEST10_CHUNKS, 30)
  return {
    message: 'Binary hint with text data',
    data: new RawStream(stream, { hint: 'binary' }),
  }
})

// Test 11: Binary hint with pure binary data
export const binaryHintBinaryFn = createServerFn().handler(async () => {
  const stream = createDelayedStream(TEST11_CHUNKS, 30)
  return {
    message: 'Binary hint with binary data',
    data: new RawStream(stream, { hint: 'binary' }),
  }
})

// ============================================================================
// MULTIPLEXING TESTS - Verify correct interleaving of multiple streams
// ============================================================================

// Expected data for multiplexing tests
// Test 12: Two streams with interleaved timing
// Stream A: sends at 0ms, 150ms, 200ms (3 chunks with pauses)
// Stream B: sends at 50ms, 100ms, 250ms (3 chunks, different rhythm)
export const TEST12_STREAM_A_CHUNKS: Array<[Uint8Array, number]> = [
  [encode('A1-first'), 0], // immediate
  [encode('A2-after-pause'), 150], // 150ms pause
  [encode('A3-quick'), 50], // 50ms after A2
]
export const TEST12_STREAM_B_CHUNKS: Array<[Uint8Array, number]> = [
  [encode('B1-start'), 50], // 50ms after start
  [encode('B2-continue'), 50], // 50ms after B1
  [encode('B3-final'), 150], // 150ms pause then final
]
export const TEST12_STREAM_A_EXPECTED = concatBytes(
  TEST12_STREAM_A_CHUNKS.map(([chunk]) => chunk),
)
export const TEST12_STREAM_B_EXPECTED = concatBytes(
  TEST12_STREAM_B_CHUNKS.map(([chunk]) => chunk),
)

// Test 13: Burst-pause-burst pattern (single stream)
// 3 chunks quickly, long pause, 3 more chunks quickly
export const TEST13_CHUNKS: Array<[Uint8Array, number]> = [
  [encode('burst1-a'), 10],
  [encode('burst1-b'), 10],
  [encode('burst1-c'), 10],
  [encode('pause-then-burst2-a'), 200], // long pause
  [encode('burst2-b'), 10],
  [encode('burst2-c'), 10],
]
export const TEST13_EXPECTED = concatBytes(
  TEST13_CHUNKS.map(([chunk]) => chunk),
)

// Test 14: Three concurrent streams with different patterns
// Stream A: fast steady (every 30ms)
// Stream B: slow steady (every 100ms)
// Stream C: burst pattern (quick-pause-quick)
export const TEST14_STREAM_A_CHUNKS: Array<[Uint8Array, number]> = [
  [encode('A1'), 30],
  [encode('A2'), 30],
  [encode('A3'), 30],
  [encode('A4'), 30],
]
export const TEST14_STREAM_B_CHUNKS: Array<[Uint8Array, number]> = [
  [encode('B1-slow'), 100],
  [encode('B2-slow'), 100],
]
export const TEST14_STREAM_C_CHUNKS: Array<[Uint8Array, number]> = [
  [encode('C1-burst'), 20],
  [encode('C2-burst'), 20],
  [encode('C3-after-pause'), 150],
]
export const TEST14_STREAM_A_EXPECTED = concatBytes(
  TEST14_STREAM_A_CHUNKS.map(([chunk]) => chunk),
)
export const TEST14_STREAM_B_EXPECTED = concatBytes(
  TEST14_STREAM_B_CHUNKS.map(([chunk]) => chunk),
)
export const TEST14_STREAM_C_EXPECTED = concatBytes(
  TEST14_STREAM_C_CHUNKS.map(([chunk]) => chunk),
)

// Test 12: Interleaved multiplexing - two streams with variable delays
export const interleavedStreamsFn = createServerFn().handler(async () => {
  const streamA = createVariableDelayStream(TEST12_STREAM_A_CHUNKS)
  const streamB = createVariableDelayStream(TEST12_STREAM_B_CHUNKS)

  return {
    message: 'Interleaved streams test',
    streamA: new RawStream(streamA),
    streamB: new RawStream(streamB),
  }
})

// Test 13: Burst-pause-burst pattern
export const burstPauseBurstFn = createServerFn().handler(async () => {
  const stream = createVariableDelayStream(TEST13_CHUNKS)

  return {
    message: 'Burst-pause-burst test',
    data: new RawStream(stream),
  }
})

// Test 14: Three concurrent streams
export const threeStreamsFn = createServerFn().handler(async () => {
  const streamA = createVariableDelayStream(TEST14_STREAM_A_CHUNKS)
  const streamB = createVariableDelayStream(TEST14_STREAM_B_CHUNKS)
  const streamC = createVariableDelayStream(TEST14_STREAM_C_CHUNKS)

  return {
    message: 'Three concurrent streams test',
    fast: new RawStream(streamA),
    slow: new RawStream(streamB),
    burst: new RawStream(streamC),
  }
})

// ============================================================================
// EDGE CASE TESTS
// ============================================================================

// Test 15: Empty stream (zero bytes)
export const emptyStreamFn = createServerFn().handler(async () => {
  // Stream that immediately closes with no data
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.close()
    },
  })

  return {
    message: 'Empty stream test',
    data: new RawStream(stream),
  }
})

// Test 16: Stream that errors mid-flight
export const errorStreamFn = createServerFn().handler(async () => {
  // Stream that sends some data then errors
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encode('chunk-before-error'))
      await new Promise((resolve) => setTimeout(resolve, 50))
      controller.error(new Error('Intentional stream error'))
    },
  })

  return {
    message: 'Error stream test',
    data: new RawStream(stream),
  }
})

// Helpers for consuming streams (exported for use in components)
// Note: RawStream is the marker class used in loaders/server functions,
// but after SSR deserialization it becomes ReadableStream<Uint8Array>.
// We accept both types to handle the TypeScript mismatch.
function getActualStream(
  stream: ReadableStream<Uint8Array> | RawStream,
): ReadableStream<Uint8Array> {
  return stream instanceof RawStream
    ? stream.stream
    : (stream as ReadableStream<Uint8Array>)
}

const streamTextCache = new WeakMap<
  ReadableStream<Uint8Array>,
  Promise<string>
>()
const streamBytesCache = new WeakMap<
  ReadableStream<Uint8Array>,
  Promise<Uint8Array>
>()
const streamByteCountCache = new WeakMap<
  ReadableStream<Uint8Array>,
  Promise<number>
>()

export function createStreamConsumer() {
  const decoder = new TextDecoder()

  return async function consumeStream(
    stream: ReadableStream<Uint8Array> | RawStream,
  ): Promise<string> {
    const actualStream = getActualStream(stream)
    const cached = streamTextCache.get(actualStream)
    if (cached) {
      return cached
    }

    const promise = (async () => {
      const reader = actualStream.getReader()
      const chunks: Array<string> = []

      try {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(decoder.decode(value, { stream: true }))
        }
      } finally {
        reader.releaseLock()
      }

      return chunks.join('')
    })()

    streamTextCache.set(actualStream, promise)
    return promise
  }
}

export async function consumeBinaryStream(
  stream: ReadableStream<Uint8Array> | RawStream,
): Promise<number> {
  const actualStream = getActualStream(stream)
  const cached = streamByteCountCache.get(actualStream)
  if (cached) {
    return cached
  }

  const promise = (async () => {
    const reader = actualStream.getReader()
    let totalBytes = 0

    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.length
      }
    } finally {
      reader.releaseLock()
    }

    return totalBytes
  })()

  streamByteCountCache.set(actualStream, promise)
  return promise
}

// Helper to collect all bytes from a stream
export async function collectBytes(
  stream: ReadableStream<Uint8Array> | RawStream,
): Promise<Uint8Array> {
  const actualStream = getActualStream(stream)
  const cached = streamBytesCache.get(actualStream)
  if (cached) {
    return cached
  }

  const promise = (async () => {
    const reader = actualStream.getReader()
    const chunks: Array<Uint8Array> = []
    let totalLength = 0

    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        totalLength += value.length
      }
    } finally {
      reader.releaseLock()
    }

    const result = new Uint8Array(totalLength)
    let pos = 0
    for (const chunk of chunks) {
      result.set(chunk, pos)
      pos += chunk.length
    }
    return result
  })()

  streamBytesCache.set(actualStream, promise)
  return promise
}

// Compare two Uint8Arrays byte-by-byte
export function compareBytes(
  actual: Uint8Array,
  expected: Uint8Array,
): {
  match: boolean
  mismatchIndex: number | null
  actualLength: number
  expectedLength: number
} {
  if (actual.length !== expected.length) {
    return {
      match: false,
      mismatchIndex: -1, // -1 indicates length mismatch
      actualLength: actual.length,
      expectedLength: expected.length,
    }
  }
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      return {
        match: false,
        mismatchIndex: i,
        actualLength: actual.length,
        expectedLength: expected.length,
      }
    }
  }
  return {
    match: true,
    mismatchIndex: null,
    actualLength: actual.length,
    expectedLength: expected.length,
  }
}
