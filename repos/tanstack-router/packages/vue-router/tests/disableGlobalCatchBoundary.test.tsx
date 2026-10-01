import * as Vue from 'vue'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/vue'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'

function ThrowingComponent(): Vue.VNode {
  throw new Error('Test error')
}

// Custom error boundary component for Vue
const TestErrorBoundary = Vue.defineComponent({
  setup(_, { slots }) {
    const error = Vue.ref<Error | null>(null)

    Vue.onErrorCaptured((err) => {
      error.value = err
      return false // Stop propagation
    })

    return () => {
      if (error.value) {
        return <div>External Error Boundary Caught: {error.value.message}</div>
      }
      return slots.default?.()
    }
  },
})

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

    render(<RouterProvider router={router} />)

    // The global CatchBoundary shows "Error" as heading and the error message in the body
    const errorElement = await screen.findByText('Test error')
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
