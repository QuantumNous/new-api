import { afterEach, describe, expect, it, vi } from 'vitest'
import React from 'react'
import ReactDOMServer from 'react-dom/server'
import { act, cleanup, render, screen } from '@testing-library/react'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'
import { ClientOnly } from '../src/ClientOnly'

afterEach(() => {
  vi.resetAllMocks()
  cleanup()
})

function createTestRouter(opts: { isServer: boolean }) {
  const history = createMemoryHistory({ initialEntries: ['/'] })

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
  const otherRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/other',
    component: () => (
      <div>
        <p data-testid="other-route">Other Route</p>
      </div>
    ),
  })

  const routeTree = rootRoute.addChildren([indexRoute, otherRoute])
  const router = createRouter({ routeTree, history, ...opts })

  return {
    router,
    routes: { indexRoute },
  }
}

describe('ClientOnly', () => {
  it('should render fallback during SSR', async () => {
    const { router } = createTestRouter({ isServer: true })
    await router.load()

    // Initial render (SSR)
    const html = ReactDOMServer.renderToString(
      <RouterProvider router={router} />,
    )
    expect(html).include('Loading...')
    expect(html).not.include('Client Only Content')
  })

  it('should render client content after hydration', async () => {
    const { router } = createTestRouter({ isServer: false })
    await router.load()

    // Mock useSyncExternalStore to simulate hydration
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation(() => true)

    render(<RouterProvider router={router} />)

    expect(await screen.findByTestId('client-only-content')).toBeInTheDocument()
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('should handle navigation with client-only content', async () => {
    const { router } = createTestRouter({ isServer: false })
    await router.load()

    // Simulate hydration
    vi.spyOn(React, 'useSyncExternalStore').mockImplementation(() => true)

    // Re-render after hydration
    render(<RouterProvider router={router} />)

    expect(await screen.findByTestId('client-only-content')).toBeInTheDocument()

    // Navigate to a different route and back
    await act(() => router.navigate({ to: '/other' }))
    expect(await screen.findByTestId('other-route')).toBeInTheDocument()

    await act(() => router.navigate({ to: '/' }))

    // Content should still be visible after navigation
    expect(await screen.findByTestId('client-only-content')).toBeInTheDocument()
  })
})
