// On-demand backpressure test for transformStreamWithRouter.
//
// NOT run in CI by default. To execute:
//   RUN_BACKPRESSURE_PERF=1 pnpm --filter @tanstack/router-core test:unit -- transformStreamBackpressure
//
// Validates fix for TanStack/router#7402
// without a backpressure gate the read loop in
// transformStreamWithRouter calls controller.enqueue unconditionally,
// allowing controller.[[queue]] to accumulate Uint8Array chunks (external
// memory) when the consumer drains slower than the producer.
import { ReadableStream } from 'node:stream/web'
import { describe, expect, it } from 'vitest'
import { transformStreamWithRouter } from '../src/ssr/transformStreamWithRouter'

const enabled = process.env.RUN_BACKPRESSURE_PERF === '1'
const requiresGc = typeof (globalThis as any).gc === 'function'

function createFastProducer(
  chunkCount: number,
  chunkBytes: number,
  opts: { freshChunks?: boolean } = {},
) {
  let pulls = 0
  let produced = 0
  const reusable = opts.freshChunks
    ? null
    : new Uint8Array(chunkBytes).fill(0x61)
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls++
      if (produced >= chunkCount) {
        controller.close()
        return
      }
      produced++
      // Fresh allocation for external-memory tests: reusing one Uint8Array
      // means the upstream queue never actually retains additional native
      // memory even if our transform held arbitrarily many references.
      controller.enqueue(
        opts.freshChunks ? new Uint8Array(chunkBytes).fill(0x61) : reusable!,
      )
    },
  })
  return {
    stream,
    getPulls: () => pulls,
    getProduced: () => produced,
  }
}

function makeRouter() {
  return {
    serverSsr: {
      isSerializationFinished: () => true,
      reserveStreamFastPath: () => true,
      onInjectedHtml: () => () => {},
      onSerializationFinished: () => () => {},
      takeBufferedHtml: () => undefined,
      setRenderFinished: () => {},
      cleanup: () => {},
    },
  } as any
}

// Main-path router fake: serialization NOT finished synchronously, so the
// transform runs the full scanner + pending HTML/scripts path. Exposes
// hooks to inject HTML and signal serialization finished.
function makeMainPathRouter(): {
  router: any
  injectHtml: (html: string) => void
  finishSerialization: () => void
} {
  let buffered = ''
  const injectedListeners: Array<() => void> = []
  const serializationListeners: Array<() => void> = []
  const router: any = {
    serverSsr: {
      isSerializationFinished: () => false,
      reserveStreamFastPath: () => false,
      onInjectedHtml: (cb: () => void) => {
        injectedListeners.push(cb)
        return () => {
          const i = injectedListeners.indexOf(cb)
          if (i >= 0) injectedListeners.splice(i, 1)
        }
      },
      onSerializationFinished: (cb: () => void) => {
        serializationListeners.push(cb)
        return () => {
          const i = serializationListeners.indexOf(cb)
          if (i >= 0) serializationListeners.splice(i, 1)
        }
      },
      takeBufferedHtml: () => {
        const v = buffered
        buffered = ''
        return v || undefined
      },
      setRenderFinished: () => {},
      cleanup: () => {},
      liftScriptBarrier: () => {},
    },
  }
  return {
    router,
    injectHtml: (html) => {
      buffered += html
      for (const l of injectedListeners) l()
    },
    finishSerialization: () => {
      for (const l of serializationListeners) l()
    },
  }
}

describe.runIf(enabled)('transformStreamWithRouter backpressure', () => {
  it('does not run producer arbitrarily ahead of slow consumer', async () => {
    const CHUNKS = 200
    const CHUNK_BYTES = 8 * 1024 // 8KB per chunk
    const producer = createFastProducer(CHUNKS, CHUNK_BYTES)
    const router = makeRouter()

    const out = transformStreamWithRouter(router, producer.stream)

    const reader = out.getReader()
    let consumed = 0
    let maxLead = 0
    while (true) {
      // Throttled consumer: ~5ms per chunk.
      await new Promise((r) => setTimeout(r, 5))
      const { done } = await reader.read()
      if (done) break
      consumed++
      const lead = producer.getProduced() - consumed
      if (lead > maxLead) maxLead = lead
    }

    // Producer should never be more than a small constant number of chunks
    // ahead of the consumer. ReadableStream default HWM is 1 for byte
    // streams; allow generous slack for scheduling jitter.
    expect(maxLead).toBeLessThanOrEqual(8)
    expect(consumed).toBe(CHUNKS)
  })

  it('bounded external memory under sustained load', async () => {
    expect(requiresGc, 'Run with node --expose-gc').toBe(true)
    const CHUNKS = 1000
    const CHUNK_BYTES = 16 * 1024
    const producer = createFastProducer(CHUNKS, CHUNK_BYTES, {
      freshChunks: true,
    })
    const router = makeRouter()

    const out = transformStreamWithRouter(router, producer.stream)
    const reader = out.getReader()

    let consumed = 0
    let peakExternal = 0
    const baseline = process.memoryUsage().external
    while (true) {
      await new Promise((r) => setTimeout(r, 2))
      const { done } = await reader.read()
      if (done) break
      consumed++
      if (consumed % 50 === 0) {
        ;(globalThis as any).gc()
        const ext = process.memoryUsage().external - baseline
        if (ext > peakExternal) peakExternal = ext
      }
    }

    // Without backpressure, peak external memory scales w/ CHUNKS*CHUNK_BYTES
    // (~16MB). With backpressure, only a few chunks worth.
    expect(peakExternal).toBeLessThan(2 * 1024 * 1024) // 2MB ceiling
    expect(consumed).toBe(CHUNKS)
  })

  it('main path: scanner+inject path also honors backpressure', async () => {
    // Same shape as fast-path test but with a router that forces the
    // scanner+inject code path. Producer emits valid HTML fragments
    // (ending at closing tags) so the scanner can release them.
    const CHUNKS = 200
    const CHUNK_BYTES = 8 * 1024
    const filler = 'a'.repeat(CHUNK_BYTES - '<p></p>'.length)
    const chunkStr = `<p>${filler}</p>`
    const encoded = new TextEncoder().encode(chunkStr)

    let produced = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (produced >= CHUNKS) {
          controller.close()
          return
        }
        produced++
        controller.enqueue(encoded)
      },
    })

    const { router, finishSerialization } = makeMainPathRouter()
    const out = transformStreamWithRouter(router, stream)
    // Mark serialization finished immediately so tryFinish() proceeds once
    // upstream closes.
    finishSerialization()

    const reader = out.getReader()
    let consumed = 0
    let bytes = 0
    let maxLead = 0
    while (true) {
      await new Promise((r) => setTimeout(r, 5))
      const { done, value } = await reader.read()
      if (done) break
      consumed++
      bytes += value.byteLength
      const lead = produced - consumed
      if (lead > maxLead) maxLead = lead
    }

    expect(maxLead).toBeLessThanOrEqual(8)
    expect(consumed).toBe(CHUNKS)
    expect(bytes).toBe(CHUNKS * encoded.byteLength)
  })

  it('main path: injected scripts under slow consumer do not balloon memory', async () => {
    expect(requiresGc, 'Run with node --expose-gc').toBe(true)

    // Producer emits a steady stream of app HTML. While that streams, the
    // router injects many large <script> chunks. With backpressure these
    // are stored as strings in pendingWrites and only encoded at enqueue
    // time, so external memory should stay bounded.
    const APP_CHUNKS = 200
    const APP_CHUNK_BYTES = 4 * 1024
    const INJECT_PER_APP_CHUNK = 5
    const SCRIPT_BYTES = 4 * 1024

    const appFiller = 'a'.repeat(APP_CHUNK_BYTES - '<p></p>'.length)
    const appChunkStr = `<p>${appFiller}</p>`
    const appBytes = new TextEncoder().encode(appChunkStr)
    const scriptFiller = 's'.repeat(SCRIPT_BYTES - '<script></script>'.length)
    const scriptStr = `<script>${scriptFiller}</script>`

    const { router, injectHtml, finishSerialization } = makeMainPathRouter()

    let produced = 0
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (produced >= APP_CHUNKS) {
          controller.close()
          return
        }
        produced++
        // Inject some scripts as part of producing this chunk to simulate
        // a render that emits HTML AND injects head scripts concurrently.
        for (let i = 0; i < INJECT_PER_APP_CHUNK; i++) injectHtml(scriptStr)
        controller.enqueue(appBytes)
      },
    })

    const out = transformStreamWithRouter(router, stream)
    finishSerialization()
    const reader = out.getReader()

    const baseline = process.memoryUsage().external
    let peakExternal = 0
    let consumed = 0
    let totalText = ''
    while (true) {
      await new Promise((r) => setTimeout(r, 2))
      const { done, value } = await reader.read()
      if (done) break
      consumed++
      totalText += Buffer.from(value).toString('utf8')
      if (consumed % 25 === 0) {
        ;(globalThis as any).gc()
        const ext = process.memoryUsage().external - baseline
        if (ext > peakExternal) peakExternal = ext
      }
    }

    // Total bytes produced ≈ APP_CHUNKS * (APP_CHUNK_BYTES + 5*SCRIPT_BYTES)
    //                     ≈ 200 * (4KB + 20KB) ≈ 4.8MB
    // With backpressure peak external should stay well below total.
    expect(peakExternal).toBeLessThan(2 * 1024 * 1024)
    expect(totalText.split(appChunkStr).length - 1).toBe(APP_CHUNKS)
    expect(totalText.split(scriptStr).length - 1).toBe(
      APP_CHUNKS * INJECT_PER_APP_CHUNK,
    )
  })
})
