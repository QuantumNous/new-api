import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'

// Middleware that throws an unhandled exception
// Issue #5266: Server crashes when unhandled exception in server function or middleware
const throwingMiddleware = createMiddleware({ type: 'function' }).server(
  async () => {
    throw new Error('Unhandled middleware exception')
  },
)

const serverFnWithThrowingMiddleware = createServerFn({ method: 'GET' })
  .middleware([throwingMiddleware])
  .handler(() => {
    return { success: true }
  })

export const Route = createFileRoute('/middleware/unhandled-exception')({
  loader: async () => {
    return {
      result: await serverFnWithThrowingMiddleware(),
    }
  },
  errorComponent: ({ error }) => {
    return (
      <div data-testid="unhandled-exception-error">
        <h1>Error Caught</h1>
        <p data-testid="error-message">
          {error instanceof Error ? error.message : 'Unknown error'}
        </p>
      </div>
    )
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <div data-testid="route-success">Should not render</div>
}
