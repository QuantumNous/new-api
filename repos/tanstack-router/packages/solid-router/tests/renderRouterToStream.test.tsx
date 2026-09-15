import { afterEach, describe, expect, test, vi } from 'vitest'
import { attachRouterServerSsrUtils } from '@tanstack/router-core/ssr/server'
import { createMemoryHistory, createRootRoute, createRouter } from '../src'
import type * as SolidWeb from 'solid-js/web'

const solidMocks = vi.hoisted(() => ({
  renderToStream: vi.fn(),
  pipeTo: vi.fn(),
}))

vi.mock('solid-js/web', async () => {
  const actual = await vi.importActual<typeof SolidWeb>('solid-js/web')
  return {
    ...actual,
    renderToStream: solidMocks.renderToStream,
  }
})

// Imported after mock so the wrapper picks up the mocked binding.
const { renderRouterToStream } = await import('../src/ssr/renderRouterToStream')

function unwrapResponse(
  result: Awaited<ReturnType<typeof renderRouterToStream>>,
) {
  return result.response
}

afterEach(() => {
  solidMocks.renderToStream.mockReset()
  solidMocks.pipeTo.mockReset()
  vi.restoreAllMocks()
})

async function buildRouter() {
  const rootRoute = createRootRoute({
    component: () => null,
  })
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute,
  })
  router.isServer = true
  attachRouterServerSsrUtils({ router, manifest: undefined })
  await router.load()
  return router
}

function drainBody(response: Response) {
  const reader = response.body!.getReader()
  return (async () => {
    for (;;) {
      const { done } = await reader.read()
      if (done) return true
    }
  })().catch(() => true)
}

describe('renderRouterToStream - bot abort', () => {
  test('request abort during bot wait returns and terminates response stream', async () => {
    const neverReady = new Promise<void>(() => {})
    solidMocks.pipeTo.mockImplementationOnce(
      (writable: WritableStream<Uint8Array>) => {
        const writer = writable.getWriter()
        return writer
          .write(new TextEncoder().encode('<html><body>solid</body></html>'))
          .catch(() => {})
      },
    )
    solidMocks.renderToStream.mockImplementationOnce(
      () =>
        ({
          then: neverReady.then.bind(neverReady),
          pipeTo: solidMocks.pipeTo,
        }) as any,
    )

    const router = await buildRouter()
    const abortController = new AbortController()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const responsePromise = renderRouterToStream({
        request: new Request('http://localhost/', {
          headers: { 'User-Agent': 'Googlebot' },
          signal: abortController.signal,
        }),
        router,
        responseHeaders: new Headers(),
        children: () => null,
      })

      await Promise.resolve()
      abortController.abort(new Error('client-gone'))

      const result = await Promise.race([
        responsePromise,
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 2000)),
      ])

      expect(result).not.toBe(false)
      expect(solidMocks.pipeTo).not.toHaveBeenCalled()
      const response = unwrapResponse(result as Exclude<typeof result, false>)

      const terminated = await Promise.race([
        drainBody(response),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 2000)),
      ])

      expect(terminated).toBe(true)
    } finally {
      errorSpy.mockRestore()
      router.serverSsr?.cleanup()
    }
  })

  test('pipeTo rejection aborts writer and terminates response stream', async () => {
    solidMocks.renderToStream.mockImplementationOnce(
      () =>
        ({
          pipeTo: () => Promise.reject(new Error('solid-pipe-failed')),
        }) as any,
    )

    const router = await buildRouter()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = unwrapResponse(
        await renderRouterToStream({
          request: new Request('http://localhost/'),
          router,
          responseHeaders: new Headers(),
          children: () => null,
        }),
      )

      const terminated = await Promise.race([
        drainBody(response),
        new Promise<false>((resolve) => setTimeout(() => resolve(false), 2000)),
      ])

      expect(terminated).toBe(true)
      expect(errorSpy).toHaveBeenCalled()
    } finally {
      errorSpy.mockRestore()
      router.serverSsr?.cleanup()
    }
  })
})
