import { describe, expect, it } from 'vitest'
import { renderToStringAsync } from 'solid-js/web'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '../../src'
import { ClientOnly } from '../../src/ClientOnly'
import type { RouterHistory } from '../../src'

function createTestRouter(initialHistory?: RouterHistory) {
  const history =
    initialHistory ?? createMemoryHistory({ initialEntries: ['/'] })

  const rootRoute = createRootRoute({})

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <div>
        <p>Index Route</p>
        <ClientOnly fallback={<div data-testid="loading">Loading...</div>}>
          <div data-testid="client-only-content">Client Only Content</div>
        </ClientOnly>
      </div>
    ),
  })

  const routeTree = rootRoute.addChildren([indexRoute])
  const router = createRouter({ routeTree, history })

  return {
    router,
    routes: { indexRoute },
  }
}

describe('ClientOnly (server)', () => {
  it('should render fallback during SSR', async () => {
    const { router } = createTestRouter()
    await router.load()

    // Initial render (SSR)
    const html = await renderToStringAsync(() => (
      <RouterProvider router={router} />
    ))

    expect(html).include('Loading...')
    expect(html).not.include('Client Only Content')
  })
})
