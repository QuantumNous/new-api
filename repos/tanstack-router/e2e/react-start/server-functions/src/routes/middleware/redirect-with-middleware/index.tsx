import { createFileRoute, redirect } from '@tanstack/react-router'
import {
  createMiddleware,
  createServerFn,
  useServerFn,
} from '@tanstack/react-start'
import { useState } from 'react'

// Function middleware that adds context
// Issue #5372: Middleware causes serialization error when throwing redirects via server function
const testMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    return next({
      context: {
        fromMiddleware: true,
      },
    })
  },
)

// Server function with middleware that throws redirect
const $redirectWithMiddleware = createServerFn({ method: 'POST' })
  .middleware([testMiddleware])
  .handler(async () => {
    throw redirect({ to: '/middleware/redirect-with-middleware/target' })
  })

export const Route = createFileRoute('/middleware/redirect-with-middleware/')({
  component: RouteComponent,
})

function RouteComponent() {
  const redirectFn = useServerFn($redirectWithMiddleware)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="p-4">
      <h1 data-testid="middleware-redirect-source">Middleware Redirect Test</h1>
      <p className="mt-2">
        This tests that redirects thrown via server functions work correctly
        when function middleware is attached (Issue #5372)
      </p>
      <button
        data-testid="trigger-redirect-btn"
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={async () => {
          try {
            setError(null)
            await redirectFn()
          } catch (e) {
            // If there's a serialization error, it will be caught here
            setError(e instanceof Error ? e.message : String(e))
          }
        }}
      >
        Trigger Redirect via Server Function
      </button>
      {error && (
        <div data-testid="error-message" className="mt-4 text-red-500">
          Error: {error}
        </div>
      )}
    </div>
  )
}
