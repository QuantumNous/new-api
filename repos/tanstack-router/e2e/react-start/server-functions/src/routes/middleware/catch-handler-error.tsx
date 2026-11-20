import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { useState } from 'react'

const errorCatchingMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    try {
      return await next()
    } catch (error) {
      const originalMessage =
        error instanceof Error ? error.message : 'Unknown error'
      throw new Error(`Middleware caught and transformed: ${originalMessage}`)
    }
  },
)

const $serverFnThatThrows = createServerFn({ method: 'GET' })
  .middleware([errorCatchingMiddleware])
  .handler(() => {
    throw new Error('This error should be caught by middleware')
  })

export const Route = createFileRoute('/middleware/catch-handler-error')({
  component: RouteComponent,
})

function RouteComponent() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      await $serverFnThatThrows()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-4">
      <h1 data-testid="catch-handler-error-title">
        Middleware Error Catching Test
      </h1>
      <p className="mt-2">
        This tests that middleware can catch and transform errors thrown by
        server function handlers
      </p>
      <button
        data-testid="trigger-error-btn"
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? 'Loading' : 'Call Server Function That Throws'}
      </button>
      {error && (
        <div data-testid="transformed-error" className="mt-4 text-red-500">
          Error: {error}
        </div>
      )}
    </div>
  )
}
