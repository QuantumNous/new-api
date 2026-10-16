import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Component } from 'react'
import {
  RouterProvider,
  createBrowserHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'
import type { ReactNode } from 'react'

import type { RouterHistory } from '../src'

function ThrowingComponent() {
  throw new Error('Test error')
}

// Custom error boundary to catch errors that bubble up
class TestErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div>External Error Boundary Caught: {this.state.error?.message}</div>
      )
    }

    return this.props.children
  }
}

let history: RouterHistory
let originalOnError: typeof window.onerror

beforeEach(() => {
  history = createBrowserHistory()
  originalOnError = window.onerror
  expect(window.location.pathname).toBe('/')
})

afterEach(() => {
  history.destroy()
  window.onerror = originalOnError
  vi.resetAllMocks()
  window.history.replaceState(null, 'root', '/')
  cleanup()
})

function createTestRouter(disableGlobalCatchBoundary: boolean) {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: ThrowingComponent,
  })

  const routeTree = rootRoute.addChildren([indexRoute])
  return createRouter({
    routeTree,
    history,
    disableGlobalCatchBoundary,
  })
}

describe('disableGlobalCatchBoundary option', () => {
  test('catches errors in global boundary when disableGlobalCatchBoundary is false', async () => {
    const router = createTestRouter(false)

    render(<RouterProvider router={router} />)

    // The global CatchBoundary shows "Something went wrong!" by default
    const errorElement = await screen.findByText('Something went wrong!')
    expect(errorElement).toBeInTheDocument()
  })

  test('errors bubble up to external error boundary when disableGlobalCatchBoundary is true', async () => {
    const router = createTestRouter(true)

    // Wrap RouterProvider in an external error boundary
    render(
      <TestErrorBoundary>
        <RouterProvider router={router} />
      </TestErrorBoundary>,
    )

    // Error should bubble up and be caught by the external error boundary
    const externalErrorElement = await screen.findByText(
      'External Error Boundary Caught: Test error',
    )
    expect(externalErrorElement).toBeInTheDocument()
  })
})
