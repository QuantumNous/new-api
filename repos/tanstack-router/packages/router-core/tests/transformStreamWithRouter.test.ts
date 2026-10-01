// CI-stable tests for transformStreamWithRouter behavior.
//
// These exercise the deterministic side-effects of the SSR memory fix
// (TanStack/router#7402) without relying on GC, timing of real I/O, or
// process.memoryUsage(). On-demand backpressure/external-memory
// assertions live in transformStreamBackpressure.perf.test.ts.
import { ReadableStream } from 'node:stream/web'
import { PassThrough } from 'node:stream'
import { describe, expect, test, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/history'
import { BaseRootRoute, BaseRoute } from '../src'
import { GLOBAL_TSR, TSR_SCRIPT_BARRIER_ID } from '../src/ssr/constants'
import { createSsrStreamResponse } from '../src/ssr/handlerCallback'
import { attachRouterServerSsrUtils } from '../src/ssr/ssr-server'
import {
  transformPipeableStreamWithRouter,
  transformReadableStreamWithRouter,
  transformStreamWithRouter,
} from '../src/ssr/transformStreamWithRouter'
import { createTestRouter } from './routerTestUtils'
import type { RouterManagedTag } from '../src/manifest'

const MAX_LEFTOVER_CHARS = 2048
const MAX_ROUTER_HTML_CHARS = 16 * 1024 * 1024

type FakeServerSsr = {
  isSerializationFinished: () => boolean
  reserveStreamFastPath: () => boolean
  onInjectedHtml: (listener: () => void) => () => void
  onSerializationFinished: (listener: () => void) => () => void
  takeBufferedHtml: () => string | undefined
  setRenderFinished: () => void
  cleanup: () => void
  liftScriptBarrier?: () => void
}

type FakeRouter = {
  serverSsr?: FakeServerSsr
}

function makeRouter(opts: Partial<FakeServerSsr> = {}): {
  router: FakeRouter
  cleanupCalls: { count: number }
  injectHtml: (html: string) => void
  finishSerialization: () => void
} {
  const cleanupCalls = { count: 0 }
  let cleanedUp = false
  let buffered = ''
  const injectedListeners: Array<() => void> = []
  const serializationListeners: Array<() => void> = []

  const router: FakeRouter = {
    serverSsr: {
      isSerializationFinished: () => false,
      reserveStreamFastPath: () => false,
      onInjectedHtml: (cb) => {
        injectedListeners.push(cb)
        return () => {
          const i = injectedListeners.indexOf(cb)
          if (i >= 0) injectedListeners.splice(i, 1)
        }
      },
      onSerializationFinished: (cb) => {
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
      cleanup: () => {
        if (cleanedUp) return
        cleanedUp = true
        cleanupCalls.count++
        router.serverSsr = undefined
      },
      liftScriptBarrier: () => {},
      ...opts,
    },
  }

  return {
    router,
    cleanupCalls,
    injectHtml: (html: string) => {
      buffered += html
      for (const l of injectedListeners.slice()) {
        try {
          l()
        } catch (err) {
          console.error('SSR injected HTML listener error:', err)
        }
      }
    },
    finishSerialization: () => {
      for (const l of serializationListeners.slice()) {
        try {
          l()
        } catch (err) {
          console.error('Serialization listener error:', err)
        }
      }
    },
  }
}

function makeManualUpstream(): {
  stream: ReadableStream<Uint8Array>
  push: (s: string) => void
  close: () => void
  cancelled: { value: boolean; reason: unknown }
} {
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined
  const cancelled = { value: false, reason: undefined as unknown }
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controllerRef = c
    },
    cancel(reason) {
      cancelled.value = true
      cancelled.reason = reason
    },
  })
  return {
    stream,
    push: (s) => controllerRef!.enqueue(encoder.encode(s)),
    close: () => controllerRef!.close(),
    cancelled,
  }
}

async function readAll(s: ReadableStream<Uint8Array>): Promise<string> {
  const reader = s.getReader()
  let out = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    // Buffer.from accepts any ArrayBufferView regardless of realm (jsdom env).
    out += Buffer.from(
      value.buffer,
      value.byteOffset,
      value.byteLength,
    ).toString('utf8')
  }
  return out
}

// Yield to the microtask queue a few times so async stream operations can
// drain. Avoids reliance on real timers.
async function flush(n = 5) {
  for (let i = 0; i < n; i++) await Promise.resolve()
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createControlledStream<T>() {
  let controller!: ReadableStreamDefaultController<T>
  const stream = new ReadableStream<T>({
    start(c) {
      controller = c
    },
  })
  return { stream, controller }
}

function renderManagedScript(tag: RouterManagedTag) {
  const attrs = tag.attrs ?? {}
  const id = attrs.id ? ` id="${attrs.id}"` : ''
  const className = attrs.className ? ` class="${attrs.className}"` : ''
  const nonce = attrs.nonce ? ` nonce="${attrs.nonce}"` : ''
  return `<script${id}${className}${nonce}>${tag.children ?? ''}</script>`
}

function createRealSsrRouter(dehydratedData: Record<string, any>) {
  const rootRoute = new BaseRootRoute({})
  const indexRoute = new BaseRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => null,
  })

  return createTestRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
    isServer: true,
    dehydrate: () => dehydratedData,
  })
}

describe('transformStreamWithRouter — real SSR scripts', () => {
  test('flushes stream-end scripts before body close when serialization finishes before transform starts', async () => {
    const streamed = createDeferred<string>()
    const router = createRealSsrRouter({ streamed: streamed.promise })
    attachRouterServerSsrUtils({ router, manifest: undefined })

    await router.load()
    await router.serverSsr!.dehydrate()

    const barrierScript = router.serverSsr!.takeBufferedScripts()
    expect(barrierScript).toBeDefined()
    expect(barrierScript!.attrs?.id).toBe(TSR_SCRIPT_BARRIER_ID)
    expect(barrierScript!.children).toContain(`${GLOBAL_TSR}.router=`)
    expect(barrierScript!.children).not.toContain(`${GLOBAL_TSR}.e()`)

    const serializationDone = new Promise<void>((resolve) => {
      router.serverSsr!.onSerializationFinished(resolve)
    })
    streamed.resolve('done')
    await serializationDone

    const upstream = makeManualUpstream()
    const output = transformStreamWithRouter(
      router as any,
      upstream.stream as any,
    )
    upstream.push(
      `<html><body><main>app</main>${renderManagedScript(
        barrierScript!,
      )}</body></html>`,
    )
    upstream.close()

    const html = await readAll(output as any)

    expect(html).toContain(`${GLOBAL_TSR}.router=`)
    expect(html).toContain(`${GLOBAL_TSR}.e()`)
    expect(html.indexOf(`${GLOBAL_TSR}.e()`)).toBeLessThan(
      html.indexOf('</body>'),
    )
  })

  test('fuses the final resolver and stream-end scripts', async () => {
    const streamed = createControlledStream<string>()
    const router = createRealSsrRouter({ streamed: streamed.stream })
    attachRouterServerSsrUtils({ router, manifest: undefined })

    await router.load()
    await router.serverSsr!.dehydrate()

    const barrierScript = router.serverSsr!.takeBufferedScripts()
    expect(barrierScript).toBeDefined()

    const upstream = makeManualUpstream()
    const output = transformStreamWithRouter(
      router as any,
      upstream.stream as any,
    )
    upstream.push(
      `<html><body><main>app</main>${renderManagedScript(
        barrierScript!,
      )}</body></html>`,
    )

    const serializationDone = new Promise<void>((resolve) => {
      router.serverSsr!.onSerializationFinished(resolve)
    })
    streamed.controller.close()
    await serializationDone
    upstream.close()

    const html = await readAll(output as any)
    const resolverIndex = html.indexOf('.return(void 0)')
    const endIndex = html.indexOf(`${GLOBAL_TSR}.e()`)

    expect(resolverIndex).toBeGreaterThan(-1)
    expect(endIndex).toBeGreaterThan(resolverIndex)
    expect(html.slice(resolverIndex, endIndex)).not.toContain('</script>')
    expect(endIndex).toBeLessThan(html.indexOf('</body>'))
  })

  test('flushes stream-end scripts even when no barrier marker was emitted', async () => {
    const streamed = createDeferred<string>()
    const router = createRealSsrRouter({ streamed: streamed.promise })
    attachRouterServerSsrUtils({ router, manifest: undefined })

    await router.load()
    await router.serverSsr!.dehydrate()

    const serializationDone = new Promise<void>((resolve) => {
      router.serverSsr!.onSerializationFinished(resolve)
    })
    streamed.resolve('done')
    await serializationDone

    const upstream = makeManualUpstream()
    const output = transformStreamWithRouter(
      router as any,
      upstream.stream as any,
    )
    upstream.push('<html><body><main>app</main></body></html>')
    upstream.close()

    const html = await readAll(output as any)

    expect(html).toContain(`${GLOBAL_TSR}.router=`)
    expect(html).toContain(`${GLOBAL_TSR}.e()`)
    expect(html.indexOf(`${GLOBAL_TSR}.e()`)).toBeLessThan(
      html.indexOf('</body>'),
    )
  })

  test('keeps stream scripts before uppercase body close', async () => {
    const streamed = createDeferred<string>()
    const router = createRealSsrRouter({ streamed: streamed.promise })
    attachRouterServerSsrUtils({ router, manifest: undefined })

    await router.load()
    await router.serverSsr!.dehydrate()
    const barrierScript = router.serverSsr!.takeBufferedScripts()!

    const upstream = makeManualUpstream()
    const output = transformStreamWithRouter(
      router as any,
      upstream.stream as any,
    )
    upstream.push(
      `<html><body>${renderManagedScript(barrierScript)}<main>app</main></BODY></HTML>`,
    )

    const serializationDone = new Promise<void>((resolve) => {
      router.serverSsr!.onSerializationFinished(resolve)
    })
    streamed.resolve('done')
    await serializationDone
    upstream.close()

    const html = await readAll(output as any)
    expect(html).toContain(`${GLOBAL_TSR}.e()`)
    expect(html.indexOf(`${GLOBAL_TSR}.e()`)).toBeLessThan(
      html.indexOf('</BODY>'),
    )
  })

  test('detects a barrier marker split across chunks', async () => {
    let liftCalls = 0
    const { router, finishSerialization } = makeRouter({
      liftScriptBarrier: () => {
        liftCalls++
      },
    })
    const upstream = makeManualUpstream()
    const output = transformStreamWithRouter(
      router as any,
      upstream.stream as any,
    )
    const splitAt = Math.floor(TSR_SCRIPT_BARRIER_ID.length / 2)

    upstream.push(
      `<html><body><script id="${TSR_SCRIPT_BARRIER_ID.slice(0, splitAt)}`,
    )
    upstream.push(
      `${TSR_SCRIPT_BARRIER_ID.slice(splitAt)}"></script><main>app</main>`,
    )
    upstream.push('</body></html>')
    upstream.close()
    finishSerialization()

    await readAll(output as any)
    expect(liftCalls).toBe(1)
  })

  test('does not inject stream scripts inside a split barrier script', async () => {
    const { router, injectHtml, finishSerialization } = makeRouter({
      liftScriptBarrier: () => {
        injectHtml('<script>streamed()</script>')
      },
    })
    const upstream = makeManualUpstream()
    const output = transformStreamWithRouter(
      router as any,
      upstream.stream as any,
    )

    upstream.push(
      `<html><body><main>app</main><script id="${TSR_SCRIPT_BARRIER_ID}`,
    )
    upstream.push(`">initial()`)
    upstream.push('</script><section>after</section>')
    finishSerialization()
    upstream.push('</body></html>')
    upstream.close()

    const html = await readAll(output as any)

    expect(html.indexOf('<script>streamed()</script>')).toBeGreaterThan(
      html.indexOf('</script><section>after</section>'),
    )
    expect(html.indexOf('<script>streamed()</script>')).toBeLessThan(
      html.indexOf('</body>'),
    )
  })

  test('remembers a flushed barrier marker until a later closing-tag boundary', async () => {
    let liftCalls = 0
    const { router, finishSerialization } = makeRouter({
      liftScriptBarrier: () => {
        liftCalls++
      },
    })
    const upstream = makeManualUpstream()
    const output = transformStreamWithRouter(
      router as any,
      upstream.stream as any,
    )
    const filler = 'x'.repeat(MAX_LEFTOVER_CHARS + 32)

    upstream.push(
      `<html><body><main>app</main><script id="${TSR_SCRIPT_BARRIER_ID}${filler}`,
    )
    await flush()
    expect(liftCalls).toBe(0)

    upstream.push('initial()</script><section>after</section>')
    upstream.push('</body></html>')
    upstream.close()
    finishSerialization()

    await readAll(output as any)
    expect(liftCalls).toBe(1)
  })
})

describe('transformStreamWithRouter — cleanup side-effects', () => {
  test('downstream cancel propagates upstream and calls serverSsr.cleanup once', async () => {
    // Fast path: simpler, no scanner. Verifies cancel + cleanup contract.
    const { router, cleanupCalls } = makeRouter({
      isSerializationFinished: () => true,
      reserveStreamFastPath: () => true,
      takeBufferedHtml: () => undefined,
    })
    const upstream = makeManualUpstream()

    const out = transformStreamWithRouter(router as any, upstream.stream as any)
    const reader = (
      out as any
    ).getReader() as ReadableStreamDefaultReader<Uint8Array>

    // Cancel before any data flows. Should still trigger upstream cancel
    // and exactly one cleanup invocation.
    await reader.cancel('consumer-gone')
    await flush()

    expect(upstream.cancelled.value).toBe(true)
    expect(cleanupCalls.count).toBe(1)
  })

  test('downstream cancel waits for upstream cancellation to settle', async () => {
    const { router, cleanupCalls } = makeRouter({
      isSerializationFinished: () => true,
      reserveStreamFastPath: () => true,
      takeBufferedHtml: () => undefined,
    })

    let resolveCancel!: () => void
    const upstream = new ReadableStream<Uint8Array>({
      pull() {
        // Keep the transform's upstream read pending until cancellation.
      },
      cancel() {
        return new Promise<void>((resolve) => {
          resolveCancel = resolve
        })
      },
    })

    const out = transformStreamWithRouter(router as any, upstream as any)
    const reader = (
      out as any
    ).getReader() as ReadableStreamDefaultReader<Uint8Array>

    let cancelSettled = false
    const cancelPromise = reader.cancel('consumer-gone').then(() => {
      cancelSettled = true
    })

    await flush()
    expect(cancelSettled).toBe(false)
    expect(cleanupCalls.count).toBe(1)

    resolveCancel()
    await cancelPromise
    expect(cancelSettled).toBe(true)
  })

  test('natural close calls cleanup exactly once', async () => {
    const { router, cleanupCalls } = makeRouter({
      isSerializationFinished: () => true,
      reserveStreamFastPath: () => true,
      takeBufferedHtml: () => undefined,
    })
    const upstream = makeManualUpstream()

    const out = transformStreamWithRouter(router as any, upstream.stream as any)

    upstream.push('<html><body>done</body></html>')
    upstream.close()

    const text = await readAll(out as any)
    expect(text).toContain('done')
    expect(cleanupCalls.count).toBe(1)
  })

  test('stream response metadata defers cleanup until body drains', async () => {
    const { router, cleanupCalls } = makeRouter({
      isSerializationFinished: () => true,
      reserveStreamFastPath: () => true,
      takeBufferedHtml: () => undefined,
    })
    const upstream = makeManualUpstream()

    const out = transformStreamWithRouter(router as any, upstream.stream as any)
    const response = new Response(out as any)
    const result = createSsrStreamResponse(router as any, response)

    expect(result.serverSsrCleanup).toBe('stream')
    expect(cleanupCalls.count).toBe(0)

    upstream.push('<html><body>done</body></html>')
    upstream.close()

    await result.response.text()
    expect(cleanupCalls.count).toBe(1)
  })

  test('stream response dispose cancels body and cleans once', async () => {
    const { router, cleanupCalls } = makeRouter({
      isSerializationFinished: () => true,
      reserveStreamFastPath: () => true,
      takeBufferedHtml: () => undefined,
    })
    const upstream = makeManualUpstream()

    const out = transformStreamWithRouter(router as any, upstream.stream as any)
    const result = createSsrStreamResponse(
      router as any,
      new Response(out as any),
    )
    expect(result.serverSsrCleanup).toBe('stream')
    if (result.serverSsrCleanup !== 'stream') return

    await result.dispose('dropped')
    await result.dispose('dropped-again')

    expect(upstream.cancelled.value).toBe(true)
    expect(cleanupCalls.count).toBe(1)
  })

  test('SSR fast path is used when explicitly safe', async () => {
    let takeBufferedHtmlCalls = 0
    let setRenderFinishedCalls = 0
    const { router, cleanupCalls } = makeRouter({
      isSerializationFinished: () => true,
      reserveStreamFastPath: () => true,
      takeBufferedHtml: () => {
        takeBufferedHtmlCalls++
        return undefined
      },
      setRenderFinished: () => {
        setRenderFinishedCalls++
      },
    })
    const upstream = makeManualUpstream()

    const out = transformStreamWithRouter(router as any, upstream.stream as any)
    upstream.push('<html><body>done</body></html>')
    upstream.close()

    const text = await readAll(out as any)
    expect(text).toBe('<html><body>done</body></html>')
    expect(takeBufferedHtmlCalls).toBe(0)
    expect(setRenderFinishedCalls).toBe(1)
    expect(cleanupCalls.count).toBe(1)
  })

  test('SSR fast path is bypassed when not explicitly safe', async () => {
    let takeBufferedHtmlCalls = 0
    let pendingHtml: string | undefined = '<script>pending()</script>'
    const { router, injectHtml, finishSerialization } = makeRouter({
      isSerializationFinished: () => true,
      reserveStreamFastPath: () => false,
      takeBufferedHtml: () => {
        takeBufferedHtmlCalls++
        const html = pendingHtml
        pendingHtml = undefined
        return html
      },
    })
    const upstream = makeManualUpstream()

    const out = transformStreamWithRouter(router as any, upstream.stream as any)
    upstream.push('<html><body>done</body></html>')
    upstream.close()
    finishSerialization()

    const text = await readAll(out as any)
    expect(text).toContain('<script>pending()</script>')
    expect(text.indexOf('<script>pending()</script>')).toBeLessThan(
      text.indexOf('</body>'),
    )
    expect(takeBufferedHtmlCalls).toBeGreaterThan(0)
  })

  test('SSR fast path errors on unexpected late injection', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { router, injectHtml, cleanupCalls } = makeRouter({
        isSerializationFinished: () => true,
        reserveStreamFastPath: () => true,
      })
      const upstream = makeManualUpstream()

      const out = transformStreamWithRouter(
        router as any,
        upstream.stream as any,
      )
      injectHtml('<script>late()</script>')

      await expect(readAll(out as any)).rejects.toThrow(
        'SSR router HTML injected during fast path',
      )
      expect(cleanupCalls.count).toBe(1)
    } finally {
      errorSpy.mockRestore()
    }
  })

  test('lifetime timeout cancels upstream and runs cleanup once', async () => {
    vi.useFakeTimers()
    try {
      const { router, cleanupCalls } = makeRouter({
        isSerializationFinished: () => true,
        takeBufferedHtml: () => undefined,
      })
      const upstream = makeManualUpstream()

      const out = transformStreamWithRouter(
        router as any,
        upstream.stream as any,
        { lifetimeMs: 10 },
      )

      // Do NOT consume. Advance fake time past lifetimeMs deterministically.
      await vi.advanceTimersByTimeAsync(15)

      expect(upstream.cancelled.value).toBe(true)
      expect(cleanupCalls.count).toBe(1)

      // Drain (read errors silently) so vitest doesn't see an unhandled error.
      const reader = (
        out as any
      ).getReader() as ReadableStreamDefaultReader<Uint8Array>
      reader.read().catch(() => {})
      reader.releaseLock()
    } finally {
      vi.useRealTimers()
    }
  })

  test('upstream cancel() that rejects does not produce an unhandled rejection', async () => {
    // Some upstream sources may reject when cancel() is called (e.g. their
    // own underlying source.cancel throws). safeCancelReader must swallow.
    const unhandled: Array<unknown> = []
    const onUnhandled = (e: PromiseRejectionEvent | any) => {
      unhandled.push(e?.reason ?? e)
    }
    process.on('unhandledRejection', onUnhandled)
    try {
      const { router, cleanupCalls } = makeRouter({
        isSerializationFinished: () => true,
        takeBufferedHtml: () => undefined,
      })

      const stream = new ReadableStream<Uint8Array>({
        start() {},
        cancel() {
          // Simulate a misbehaving upstream whose cancel rejects.
          throw new Error('boom-cancel')
        },
      })

      const out = transformStreamWithRouter(router as any, stream as any)
      const reader = (
        out as any
      ).getReader() as ReadableStreamDefaultReader<Uint8Array>

      // Consumer goes away → triggers cancelUpstream → upstream cancel throws.
      await reader.cancel('consumer-gone').catch(() => {})
      // Allow microtasks for any rejection to surface.
      await flush(10)

      expect(cleanupCalls.count).toBe(1)
      expect(
        unhandled.find(
          (e: any) => e && String(e.message || e).includes('boom-cancel'),
        ),
      ).toBeUndefined()
    } finally {
      process.off('unhandledRejection', onUnhandled)
    }
  })

  test('server cleanup throwing does not prevent terminal stream cleanup', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { router, finishSerialization } = makeRouter({
        cleanup: () => {
          throw new Error('cleanup-boom')
        },
      })
      const upstream = makeManualUpstream()

      const out = transformStreamWithRouter(
        router as any,
        upstream.stream as any,
      )
      upstream.push('<html><body>done</body></html>')
      upstream.close()
      finishSerialization()

      await expect(readAll(out as any)).resolves.toContain('done')
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
    }
  })

  test('throwing injected listener does not skip transform drain', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { router, injectHtml, finishSerialization } = makeRouter()
      router.serverSsr!.onInjectedHtml(() => {
        throw new Error('external-listener-boom')
      })
      const upstream = makeManualUpstream()

      const out = transformStreamWithRouter(
        router as any,
        upstream.stream as any,
      )

      upstream.push('<html><body><main>app</main>')
      injectHtml('<script>drained()</script>')
      upstream.push('</body></html>')
      upstream.close()
      finishSerialization()

      const text = await readAll(out as any)
      expect(text).toContain('<script>drained()</script>')
      expect(text.indexOf('<script>drained()</script>')).toBeLessThan(
        text.indexOf('</body>'),
      )
    } finally {
      errorSpy.mockRestore()
    }
  })

  test('tail overflow errors and runs cleanup', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { router, cleanupCalls, finishSerialization } = makeRouter()
      const upstream = makeManualUpstream()

      const out = transformStreamWithRouter(
        router as any,
        upstream.stream as any,
      )
      upstream.push(`<html><body>done</body>${'x'.repeat(64 * 1024 + 1)}`)
      upstream.close()
      finishSerialization()

      await expect(readAll(out as any)).rejects.toThrow(
        'SSR stream tail exceeded maximum buffer',
      )
      expect(cleanupCalls.count).toBe(1)
    } finally {
      errorSpy.mockRestore()
    }
  })

  test('router HTML overflow errors and runs cleanup', async () => {
    const { router, injectHtml, cleanupCalls } = makeRouter()
    const upstream = makeManualUpstream()

    const out = transformStreamWithRouter(router as any, upstream.stream as any)
    injectHtml('x'.repeat(MAX_ROUTER_HTML_CHARS + 1))

    await expect(readAll(out as any)).rejects.toThrow(
      'SSR router HTML exceeded maximum buffer',
    )
    expect(cleanupCalls.count).toBe(1)
  })

  test('pending output overflow errors and runs cleanup', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const { router, cleanupCalls, finishSerialization } = makeRouter()
      const upstream = makeManualUpstream()

      const out = transformStreamWithRouter(
        router as any,
        upstream.stream as any,
      )
      upstream.push(`${'x'.repeat(16 * 1024 * 1024 + 1)}</div>`)
      upstream.close()
      finishSerialization()

      await expect(readAll(out as any)).rejects.toThrow(
        'SSR stream pending output exceeded maximum buffer',
      )
      expect(cleanupCalls.count).toBe(1)
    } finally {
      errorSpy.mockRestore()
    }
  })

  test('long text without closing tags partially flushes and keeps bounded leftover', async () => {
    const { router, finishSerialization } = makeRouter()
    const upstream = makeManualUpstream()
    const out = transformStreamWithRouter(router as any, upstream.stream as any)
    const reader = (out as any).getReader()
    const text = 'x'.repeat(MAX_LEFTOVER_CHARS + 32)

    upstream.push(text)

    const first = await reader.read()
    expect(first.done).toBe(false)
    const firstText = Buffer.from(first.value).toString('utf8')
    expect(firstText).toBe('x'.repeat(32))

    upstream.close()
    finishSerialization()

    let rest = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      rest += Buffer.from(value).toString('utf8')
    }

    expect(firstText + rest).toBe(text)
  })

  test('takeBufferedHtml throwing errors stream and runs cleanup once', async () => {
    const { router, cleanupCalls } = makeRouter({
      takeBufferedHtml: () => {
        throw new Error('take-buffered-html-boom')
      },
    })
    const upstream = makeManualUpstream()

    const out = transformStreamWithRouter(router as any, upstream.stream as any)

    await expect(readAll(out as any)).rejects.toThrow('take-buffered-html-boom')
    expect(cleanupCalls.count).toBe(1)
  })

  test('downstream backpressure delays close; no chunks are lost', async () => {
    // Consumer reads slowly: we verify all router-injected scripts AND the
    // tail closing tags arrive before the stream ends, even though
    // tryFinish() requests close while writes are still queued.
    const { router, injectHtml, finishSerialization } = makeRouter()
    const upstream = makeManualUpstream()

    const out = transformStreamWithRouter(router as any, upstream.stream as any)

    upstream.push('<html><body><div>a</div>')
    // Queue many injected chunks while app is still rendering.
    for (let i = 0; i < 50; i++) injectHtml(`<script>S${i}</script>`)
    upstream.push('</body></html>')
    upstream.close()
    finishSerialization()

    const full = await readAll(out as any)

    expect(full).toContain('<div>a</div>')
    expect(full).toContain('</body></html>')
    for (let i = 0; i < 50; i++) {
      expect(full).toContain(`<script>S${i}</script>`)
    }
    // All scripts must appear before </body>.
    expect(full.indexOf('<script>S49</script>')).toBeLessThan(
      full.indexOf('</body>'),
    )
  })
})

describe('transformStreamWithRouter — injected HTML ordering', () => {
  test('router-injected HTML interleaves at scanner safe points, not mid-tag', async () => {
    const { router, injectHtml, finishSerialization } = makeRouter()
    const upstream = makeManualUpstream()

    const out = transformStreamWithRouter(router as any, upstream.stream as any)

    // App emits a chunk ending in a complete closing tag so the scanner
    // can release content + flush pending router HTML at a safe boundary.
    upstream.push('<html><body><div>app</div>')
    // Injected during render — must be buffered, not enqueued ahead of
    // pending app content, and not split across closing tags.
    injectHtml('<script>X</script>')
    injectHtml('<script>Y</script>')

    // Tail chunk: end of body. Triggers pendingClosingTags capture and
    // flushPendingRouterHtml before the tail is emitted on tryFinish.
    upstream.push('</body></html>')
    upstream.close()
    finishSerialization()

    const full = await readAll(out as any)

    // Order: app div → scripts → body close.
    expect(full).toContain('<div>app</div>')
    expect(full).toContain('<script>X</script>')
    expect(full).toContain('<script>Y</script>')
    expect(full.indexOf('<div>app</div>')).toBeLessThan(
      full.indexOf('<script>X</script>'),
    )
    expect(full.indexOf('<script>Y</script>')).toBeLessThan(
      full.indexOf('</body>'),
    )
  })

  test('onAbort: fires once when downstream cancels (readable wrapper)', async () => {
    const { router, finishSerialization } = makeRouter()
    finishSerialization()

    let produced = 0
    const upstream = new ReadableStream<Uint8Array>({
      pull(controller) {
        produced++
        controller.enqueue(new TextEncoder().encode('<p>x</p>'))
      },
    })

    let aborts = 0
    const out = transformReadableStreamWithRouter(
      router as any,
      upstream as any,
      { onAbort: () => aborts++ },
    )

    const reader = (out as any).getReader()
    await reader.read()
    await reader.cancel(new Error('client disconnect'))
    // Allow microtasks to flush.
    await Promise.resolve()
    await Promise.resolve()

    expect(aborts).toBe(1)
    expect(produced).toBeGreaterThan(0)
  })

  test('onAbort: NOT called on natural successful completion', async () => {
    const { router, finishSerialization } = makeRouter()

    const upstream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('<p>done</p>'))
        controller.close()
      },
    })

    let aborts = 0
    const out = transformReadableStreamWithRouter(
      router as any,
      upstream as any,
      { onAbort: () => aborts++ },
    )

    // tryFinish gates on serialization-finished; signal it AFTER transform
    // has subscribed to the event.
    finishSerialization()

    // Drain to completion.
    const reader = (out as any).getReader()
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }

    expect(aborts).toBe(0)
  })

  test('onAbort: fires when pipeable wrapper consumer destroys', async () => {
    const { router, finishSerialization } = makeRouter()
    finishSerialization()

    const pass = new PassThrough()
    let aborts = 0
    const out = transformPipeableStreamWithRouter(router as any, pass, {
      onAbort: () => aborts++,
    })
    // Swallow expected error emission from destroy().
    out.on('error', () => {})

    // Push something so the read loop is engaged.
    pass.write('<p>x</p>')
    // Wait a tick to let reader start.
    await new Promise((r) => setImmediate(r))

    // Destroy downstream — simulates Node response being closed by client.
    out.destroy(new Error('client gone'))
    // Allow microtasks + readable webstream cancel propagation.
    await new Promise((r) => setImmediate(r))
    await Promise.resolve()

    expect(aborts).toBe(1)

    // Cleanup: destroy upstream so we don't leak.
    if (!pass.destroyed) pass.destroy()
  })

  test('onAbort: lifetime timeout triggers abort exactly once', async () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { router, finishSerialization } = makeRouter()
      finishSerialization()

      // Upstream that never produces or closes.
      const upstream = new ReadableStream<Uint8Array>({
        pull() {
          // never enqueue, never close
        },
      })

      let aborts = 0

      const out = transformReadableStreamWithRouter(
        router as any,
        upstream as any,
        { onAbort: () => aborts++, lifetimeMs: 1000 },
      )

      // Start reading (which may reject when stream is errored)
      const reader = (out as any).getReader()
      const readP = reader.read().catch(() => undefined)

      await vi.advanceTimersByTimeAsync(1500)
      await readP

      expect(aborts).toBe(1)
    } finally {
      errorSpy.mockRestore()
      warnSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  test('default lifetime is derived from timeoutMs', async () => {
    vi.useFakeTimers()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const { router, finishSerialization } = makeRouter()
      finishSerialization()
      const upstream = new ReadableStream<Uint8Array>({
        pull() {
          // never enqueue, never close
        },
      })

      let aborts = 0
      const out = transformReadableStreamWithRouter(
        router as any,
        upstream as any,
        { onAbort: () => aborts++, timeoutMs: 10 },
      )

      const reader = (out as any).getReader()
      const readP = reader.read().catch(() => undefined)

      await vi.advanceTimersByTimeAsync(15)
      expect(aborts).toBe(0)

      await vi.advanceTimersByTimeAsync(6)
      await readP
      expect(aborts).toBe(1)
    } finally {
      errorSpy.mockRestore()
      warnSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  test('upstream writable abort surfaces; readable does not hang', async () => {
    const { router, finishSerialization } = makeRouter()
    finishSerialization()

    // Simulate the Vue sync-setup-throw recovery path: a TransformStream is
    // handed to the router transform, and the producer never writes before
    // aborting the writable side. The router transform's readable must
    // resolve (with done or an error) rather than wait for lifetimeMs.
    const ts = new TransformStream()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      let aborts = 0
      const out = transformReadableStreamWithRouter(
        router as any,
        ts.readable as any,
        { onAbort: () => aborts++ },
      )

      void ts.writable.abort(new Error('setup-throw')).catch(() => {})

      const reader = (out as any).getReader()
      // Either the read resolves with done, or it rejects with the abort
      // reason. Both prove non-hang behavior; we just require it terminates.
      const terminated = await reader
        .read()
        .then(() => true)
        .catch(() => true)

      expect(terminated).toBe(true)
      expect(aborts).toBe(1)
    } finally {
      errorSpy.mockRestore()
    }
  })
})
