import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@solidjs/testing-library'
import { ErrorBoundary } from 'solid-js'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'
import type { JSX } from 'solid-js'

function ThrowingComponent() {
  throw new Error('Test error')
}

// Custom error boundary to catch errors that bubble up
function TestErrorBoundary(props: { children: JSX.Element }) {
  return (
    <ErrorBoundary
      fallback={(err) => (
        <div>External Error Boundary Caught: {err.message}</div>
      )}
    >
      {props.children}
    </ErrorBoundary>
  )
}

function createTestRouter(disableGlobalCatchBoundary: boolean) {
  const rootRoute = createRootRoute({})
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: ThrowingComponent,
  })

  const routeTree = rootRoute.addChildren([indexRoute])
  return createRouter({
    routeTree,
    disableGlobalCatchBoundary,
  })
}

afterEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, 'root', '/')
  cleanup()
})

describe('disableGlobalCatchBoundary option', () => {
  test('catches errors in global boundary when disableGlobalCatchBoundary is false', async () => {
    const router = createTestRouter(false)

    render(() => <RouterProvider router={router} />)

    // The global CatchBoundary shows "Something went wrong!" by default
    const errorElement = await screen.findByText('Something went wrong!')
    expect(errorElement).toBeInTheDocument()
  })

  test('errors bubble up to external error boundary when disableGlobalCatchBoundary is true', async () => {
    const router = createTestRouter(true)

    // Wrap RouterProvider in an external error boundary
    render(() => (
      <TestErrorBoundary>
        <RouterProvider router={router} />
      </TestErrorBoundary>
    ))

    // Error should bubble up and be caught by the external error boundary
    const externalErrorElement = await screen.findByText(
      'External Error Boundary Caught: Test error',
    )
    expect(externalErrorElement).toBeInTheDocument()
  })
})
