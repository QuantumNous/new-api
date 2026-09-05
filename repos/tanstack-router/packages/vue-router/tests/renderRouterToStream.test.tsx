import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  attachRouterServerSsrUtils,
  normalizeSsrResponse,
} from '@tanstack/router-core/ssr/server'
import { createMemoryHistory, createRootRoute, createRouter } from '../src'
import type * as VueServerRenderer from 'vue/server-renderer'

const rendererMocks = vi.hoisted(() => ({
  pipeToWebWritable: vi.fn(),
  renderToString: vi.fn(),
}))

vi.mock('vue/server-renderer', async () => {
  const actual = await vi.importActual<typeof VueServerRenderer>(
    'vue/server-renderer',
  )
  return {
    ...actual,
    pipeToWebWritable: rendererMocks.pipeToWebWritable,
    renderToString: rendererMocks.renderToString,
  }
})

// Imported after mock so the wrapper picks up the mocked binding.
const { renderRouterToStream } = await import('../src/ssr/renderRouterToStream')

function unwrapResponse(
  result: Awaited<ReturnType<typeof renderRouterToStream>>,
) {
  return normalizeSsrResponse(result).response
}

afterEach(() => {
  rendererMocks.pipeToWebWritable.mockReset()
  rendererMocks.renderToString.mockReset()
  vi.restoreAllMocks()
})

async function buildRouter() {
  const rootRoute = createRootRoute({
    component: { template: '<div/>' } as any,
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

describe('renderRouterToStream - sync setup failures', () => {
  test('bot string response injects final scripts and cleans up', async () => {
    rendererMocks.renderToString.mockResolvedValueOnce(
      '<html><body><main>bot</main></body></html>',
    )
    const router = await buildRouter()
    await router.serverSsr!.dehydrate()
    const cleanup = vi.spyOn(router.serverSsr!, 'cleanup')

    const response = unwrapResponse(
      await renderRouterToStream({
        request: new Request('http://localhost/', {
          headers: { 'User-Agent': 'Googlebot' },
        }),
        router,
        responseHeaders: new Headers(),
        App: { template: '<div/>' } as any,
      }),
    )

    const html = await response.text()
    expect(html).toContain('$_TSR.e()')
    expect(html.indexOf('$_TSR.e()')).toBeLessThan(html.indexOf('</body>'))
    expect(cleanup).toHaveBeenCalledOnce()
    expect(router.serverSsr).toBeUndefined()
  })

  test('pipeToWebWritable sync throw terminates response stream', async () => {
    rendererMocks.pipeToWebWritable.mockImplementationOnce(() => {
      throw new Error('forced-sync-setup-throw')
    })
    const router = await buildRouter()

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = unwrapResponse(
        await renderRouterToStream({
          request: new Request('http://localhost/'),
          router,
          responseHeaders: new Headers(),
          App: { template: '<div/>' } as any,
        }),
      )

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

  test('request abort drops later Vue writes and terminates response stream', async () => {
    let vueWriter: WritableStreamDefaultWriter<Uint8Array> | undefined
    rendererMocks.pipeToWebWritable.mockImplementationOnce(
      (
        _app: unknown,
        _context: unknown,
        writable: WritableStream<Uint8Array>,
      ) => {
        vueWriter = writable.getWriter()
      },
    )

    const router = await buildRouter()
    const abortController = new AbortController()
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const response = unwrapResponse(
        await renderRouterToStream({
          request: new Request('http://localhost/', {
            signal: abortController.signal,
          }),
          router,
          responseHeaders: new Headers(),
          App: { template: '<div/>' } as any,
        }),
      )

      expect(vueWriter).toBeDefined()
      abortController.abort(new Error('client-gone'))

      await expect(
        vueWriter!.write(new TextEncoder().encode('<div/>')),
      ).resolves.toBeUndefined()

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
})
