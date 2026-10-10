import { createFileRoute } from '@tanstack/react-router'
import { getMiddlewareExecutionCounts, loggingMiddleware } from '~/start'

export const Route = createFileRoute('/server-route-with-middleware')({
  // Server route configuration
  // loggingMiddleware is ALSO in global requestMiddleware (see start.ts)
  // This tests that it only executes once, not twice
  server: {
    middleware: [loggingMiddleware],
    handlers: {
      GET: async ({ next, context }) => {
        // Get the middleware execution counts at the time of the GET handler
        const counts = await getMiddlewareExecutionCounts()

        // Add counts to context - this will be passed to the router as serverContext
        return next({
          context: {
            middlewareCountsAtHandler: counts,
          },
        })
      },
    },
  },
  // beforeLoad runs on server during SSR, can access serverContext
  beforeLoad: async ({ context, serverContext }) => {
    // On server, serverContext contains data from GET handler + middleware context
    // On client (navigation), serverContext won't be present

    // Get the final middleware execution counts
    const finalCounts = await getMiddlewareExecutionCounts()

    return {
      serverContext,
      middlewareCounts: finalCounts,
    }
  },
  component: ServerRouteWithMiddleware,
})

function ServerRouteWithMiddleware() {
  const { serverContext, middlewareCounts } = Route.useRouteContext()

  return (
    <div className="p-8">
      <h1 className="font-bold text-lg mb-4">
        Server Route with Global Middleware Test
      </h1>

      <div className="mb-4">
        <h2 className="font-semibold">Middleware Execution Counts:</h2>
        <pre
          data-testid="middleware-counts"
          className="bg-gray-100 p-2 rounded text-black"
        >
          {JSON.stringify(middlewareCounts, null, 2)}
        </pre>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">loggingMiddleware Count:</h2>
        <span data-testid="logging-middleware-count">
          {(middlewareCounts as any)?.loggingMiddleware ?? 'N/A'}
        </span>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">authMiddleware Count:</h2>
        <span data-testid="auth-middleware-count">
          {(middlewareCounts as any)?.authMiddleware ?? 'N/A'}
        </span>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Server Context:</h2>
        <pre
          data-testid="server-context"
          className="bg-gray-100 p-2 rounded text-black"
        >
          {JSON.stringify(serverContext, null, 2)}
        </pre>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Deduplication Status:</h2>
        <span
          data-testid="dedup-status"
          className={
            (middlewareCounts as any)?.loggingMiddleware === 1
              ? 'text-green-600 font-bold'
              : 'text-red-600 font-bold'
          }
        >
          {(middlewareCounts as any)?.loggingMiddleware === 1
            ? 'SUCCESS: loggingMiddleware executed exactly once'
            : `FAILURE: loggingMiddleware executed ${(middlewareCounts as any)?.loggingMiddleware ?? 0} times (expected 1)`}
        </span>
      </div>
    </div>
  )
}
