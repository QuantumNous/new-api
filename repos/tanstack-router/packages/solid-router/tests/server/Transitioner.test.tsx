import { describe, expect, it, vi } from 'vitest'
import { renderToStringAsync } from 'solid-js/web'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '../../src'
import { RouterProvider } from '../../src/RouterProvider'

describe('Transitioner (server)', () => {
  it('should call router.load() only once when on the server', async () => {
    const loader = vi.fn()
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <div>Index</div>,
      loader,
    })

    const routeTree = rootRoute.addChildren([indexRoute])
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/'],
      }),
      isServer: true,
    })

    // Mock router.load() to verify it gets called
    const loadSpy = vi.spyOn(router, 'load')

    await router.load()

    await renderToStringAsync(() => <RouterProvider router={router} />)

    expect(loadSpy).toHaveBeenCalledTimes(1)
    expect(loader).toHaveBeenCalledTimes(1)

    loadSpy.mockRestore()
  })
})
