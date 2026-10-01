import { createMemoryHistory } from '@tanstack/history'
import { describe, expect, test, vi } from 'vitest'
import { BaseRootRoute, BaseRoute } from '../src'
import { createRequestHandler } from '../src/ssr/createRequestHandler'
import { createSsrStreamResponse } from '../src/ssr/handlerCallback'
import { attachRouterServerSsrUtils } from '../src/ssr/ssr-server'
import { transformStreamWithRouter } from '../src/ssr/transformStreamWithRouter'
import { createTestRouter } from './routerTestUtils'

/**
 * CI-stable tests for the SSR cleanup contract. These do not rely on GC
 * timing; they exercise the observable behavior:
 *   - onCleanup listeners run exactly once
 *   - cleanup is reentrancy-safe (listener calling cleanup again is a no-op)
 *   - cleanup is idempotent (second cleanup() call is a no-op)
 */

function buildRouter(dehydratedData?: Record<string, any>) {
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
    dehydrate: dehydratedData ? () => dehydratedData : undefined,
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

describe('serverSsr.cleanup', () => {
  test('onCleanup listeners run exactly once', () => {
    const router = buildRouter()
    attachRouterServerSsrUtils({ router, manifest: undefined })

    let calls = 0
    router.serverSsr!.onCleanup(() => {
      calls++
    })

    router.serverSsr!.cleanup()
    // Second call: serverSsr is undefined now, must short-circuit safely.
    router.serverSsr?.cleanup()
    expect(calls).toBe(1)
  })

  test('listener that re-enters cleanup() does not re-fire siblings', () => {
    const router = buildRouter()
    attachRouterServerSsrUtils({ router, manifest: undefined })

    const order: Array<string> = []
    router.serverSsr!.onCleanup(() => {
      order.push('a')
      // Reentry: must be a no-op.
      router.serverSsr?.cleanup()
    })
    router.serverSsr!.onCleanup(() => {
      order.push('b')
    })

    router.serverSsr!.cleanup()
    expect(order).toEqual(['a', 'b'])
  })

  test('listener errors are swallowed and do not stop subsequent listeners', () => {
    const router = buildRouter()
    attachRouterServerSsrUtils({ router, manifest: undefined })

    const order: Array<string> = []
    router.serverSsr!.onCleanup(() => {
      order.push('a')
      throw new Error('boom')
    })
    router.serverSsr!.onCleanup(() => {
      order.push('b')
    })

    // Should not throw.
    router.serverSsr!.cleanup()
    expect(order).toEqual(['a', 'b'])
  })

  test('cleanup before pending serialization resolves drops late scripts safely', async () => {
    const value = deferred<string>()
    const router = buildRouter({ value: value.promise })
    attachRouterServerSsrUtils({ router, manifest: undefined })

    await router.load()
    await router.serverSsr!.dehydrate()
    router.serverSsr!.cleanup()

    value.resolve('done')
    await Promise.resolve()
    await Promise.resolve()

    expect(router.serverSsr).toBeUndefined()
  })

  test('serialization completion does not clear render-finished listeners', async () => {
    const value = deferred<string>()
    const router = buildRouter({ value: value.promise })
    attachRouterServerSsrUtils({ router, manifest: undefined })

    await router.load()
    await router.serverSsr!.dehydrate()

    let renderFinishedCalls = 0
    router.serverSsr!.onRenderFinished(() => {
      renderFinishedCalls++
    })

    const serializationDone = new Promise<void>((resolve) => {
      router.serverSsr!.onSerializationFinished(resolve)
    })

    value.resolve('done')
    await serializationDone

    expect(renderFinishedCalls).toBe(0)
    router.serverSsr!.setRenderFinished()
    expect(renderFinishedCalls).toBe(1)

    router.serverSsr?.cleanup()
  })

  test('render-finished listeners can synchronously finish serialization', async () => {
    const value = deferred<string>()
    const router = buildRouter({ value: value.promise })
    attachRouterServerSsrUtils({ router, manifest: undefined })

    await router.load()
    await router.serverSsr!.dehydrate()
    router.serverSsr!.takeBufferedScripts()

    router.serverSsr!.onRenderFinished(() => {
      value.resolve('done')
    })

    const serializationDone = new Promise<void>((resolve) => {
      router.serverSsr!.onSerializationFinished(resolve)
    })
    router.serverSsr!.setRenderFinished()
    await serializationDone

    expect(router.serverSsr!.takeBufferedHtml()).toContain('$_TSR.e()')

    router.serverSsr?.cleanup()
  })

  test('late serialization listener runs safely and returns unsubscribe', async () => {
    const router = buildRouter()
    attachRouterServerSsrUtils({ router, manifest: undefined })

    await router.load()
    await router.serverSsr!.dehydrate()

    let calls = 0
    const unsubscribe = router.serverSsr!.onSerializationFinished(() => {
      calls++
    })

    expect(calls).toBe(1)
    expect(() => unsubscribe()).not.toThrow()
    router.serverSsr?.cleanup()
  })

  test('stream fast path only reserves when no SSR work is pending', async () => {
    const router = buildRouter()
    attachRouterServerSsrUtils({ router, manifest: undefined })

    await router.load()
    await router.serverSsr!.dehydrate()
    const barrierScript = router.serverSsr!.takeBufferedScripts()
    expect(barrierScript).toBeDefined()

    router.serverSsr!.setRenderFinished()
    expect(router.serverSsr!.reserveStreamFastPath()).toBe(true)
    expect(router.serverSsr!.reserveStreamFastPath()).toBe(false)

    router.serverSsr?.cleanup()
  })

  test('stream fast path rejects while SSR work is pending', async () => {
    const value = deferred<string>()
    const router = buildRouter({ value: value.promise })
    attachRouterServerSsrUtils({ router, manifest: undefined })

    await router.load()
    await router.serverSsr!.dehydrate()

    expect(router.serverSsr!.reserveStreamFastPath()).toBe(false)
    const barrierScript = router.serverSsr!.takeBufferedScripts()
    expect(barrierScript).toBeDefined()
    expect(router.serverSsr!.reserveStreamFastPath()).toBe(false)

    const serializationDone = new Promise<void>((resolve) => {
      router.serverSsr!.onSerializationFinished(resolve)
    })
    value.resolve('done')
    await serializationDone

    expect(router.serverSsr!.reserveStreamFastPath()).toBe(false)
    router.serverSsr!.setRenderFinished()
    expect(router.serverSsr!.reserveStreamFastPath()).toBe(false)
    expect(router.serverSsr!.takeBufferedHtml()).toContain('<script')

    router.serverSsr?.cleanup()
  })

  test('throwing injected listener does not skip later listeners', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const router = buildRouter()
    try {
      attachRouterServerSsrUtils({ router, manifest: undefined })

      const calls: Array<string> = []
      router.serverSsr!.onInjectedHtml(() => {
        calls.push('a')
        throw new Error('boom')
      })
      router.serverSsr!.onInjectedHtml(() => {
        calls.push('b')
      })

      router.serverSsr!.injectHtml('<script>1</script>')

      expect(calls).toEqual(['a', 'b'])
    } finally {
      router.serverSsr?.cleanup()
      errorSpy.mockRestore()
    }
  })

  test('server SSR attach lifecycle runs listeners at attach time', () => {
    const router = buildRouter()
    const calls: Array<string> = []
    router.serverSsrLifecycle = {
      onServerSsrAttach: [
        (serverSsr) => {
          calls.push('attach')
          serverSsr.onCleanup(() => calls.push('cleanup'))
        },
      ],
    }

    attachRouterServerSsrUtils({ router, manifest: undefined })
    expect(calls).toEqual(['attach'])

    router.serverSsr!.cleanup()
    expect(calls).toEqual(['attach', 'cleanup'])
  })

  test('request handler cleans plain response body after drain', async () => {
    const router = buildRouter()
    let cleanupCalls = 0
    const handler = createRequestHandler({
      createRouter: () => router,
      request: new Request('http://localhost/'),
    })

    const response = await handler(({ router: requestRouter }) => {
      const serverSsr = requestRouter.serverSsr!
      const cleanup = serverSsr.cleanup
      serverSsr.cleanup = () => {
        cleanupCalls++
        cleanup()
      }
      return Promise.resolve(new Response('plain'))
    })

    expect(cleanupCalls).toBe(1)
    await response.text()
    expect(cleanupCalls).toBe(1)
    expect(router.serverSsr).toBeUndefined()
  })

  test('request handler cleans plain response body on cancel', async () => {
    const router = buildRouter()
    let cleanupCalls = 0
    const handler = createRequestHandler({
      createRouter: () => router,
      request: new Request('http://localhost/'),
    })

    const response = await handler(({ router: requestRouter }) => {
      const serverSsr = requestRouter.serverSsr!
      const cleanup = serverSsr.cleanup
      serverSsr.cleanup = () => {
        cleanupCalls++
        cleanup()
      }
      return Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode('plain'))
            },
          }),
        ),
      )
    })

    expect(cleanupCalls).toBe(1)
    await response.body!.cancel('done')
    expect(cleanupCalls).toBe(1)
    expect(router.serverSsr).toBeUndefined()
  })

  test('request handler cleans bodyless response immediately', async () => {
    const router = buildRouter()
    let cleanupCalls = 0
    const handler = createRequestHandler({
      createRouter: () => router,
      request: new Request('http://localhost/'),
    })

    await handler(({ router: requestRouter }) => {
      const serverSsr = requestRouter.serverSsr!
      const cleanup = serverSsr.cleanup
      serverSsr.cleanup = () => {
        cleanupCalls++
        cleanup()
      }
      return Promise.resolve(new Response(null, { status: 204 }))
    })

    expect(cleanupCalls).toBe(1)
    expect(router.serverSsr).toBeUndefined()
  })

  test('request handler defers cleanup for stream response metadata', async () => {
    const router = buildRouter()
    let cleanupCalls = 0
    let controller!: ReadableStreamDefaultController<Uint8Array>
    const handler = createRequestHandler({
      createRouter: () => router,
      request: new Request('http://localhost/'),
    })

    const response = await handler(({ router: requestRouter }) => {
      const serverSsr = requestRouter.serverSsr!
      const cleanup = serverSsr.cleanup
      serverSsr.cleanup = () => {
        cleanupCalls++
        cleanup()
      }
      const appStream = new ReadableStream<Uint8Array>({
        start(c) {
          controller = c
        },
      })
      const responseStream = transformStreamWithRouter(
        requestRouter,
        appStream as any,
      )

      return createSsrStreamResponse(
        requestRouter,
        new Response(responseStream as any),
      )
    })

    expect(cleanupCalls).toBe(0)
    controller.enqueue(new TextEncoder().encode('<html><body>ok</body></html>'))
    controller.close()
    await response.text()
    expect(cleanupCalls).toBe(1)
    expect(router.serverSsr).toBeUndefined()
  })
})
