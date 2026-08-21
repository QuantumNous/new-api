import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/vue'
import { createRootRoute, createRouter } from '../src'
import { RouterProvider } from '../src/RouterProvider'

describe('shellComponent', () => {
  it('should wrap the root route with shellComponent', async () => {
    const Shell = (_: unknown, { slots }: { slots: any }) => (
      <div data-testid="shell">{slots.default?.()}</div>
    )

    const rootRoute = createRootRoute({
      shellComponent: Shell,
      component: () => <div data-testid="child">child</div>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([]),
    })

    const app = render(<RouterProvider router={router} />)

    const shell = await app.findByTestId('shell')
    expect(shell).toBeInTheDocument()
    expect(shell).toContainHTML('child')
  })
})
