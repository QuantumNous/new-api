import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { loggingMiddleware, getMiddlewareExecutionCounts } from '~/start'

// This test reproduces issue #5239:
// - loggingMiddleware is registered as global REQUEST middleware in start.ts
// - The same loggingMiddleware is also attached to this server function
// - The bug is that it executes multiple times instead of being deduped

// Simple server function that uses loggingMiddleware
// loggingMiddleware is already in requestMiddleware in start.ts
// If we also attach it here, it should be deduped and run only once per context
const simpleServerFn = createServerFn()
  .middleware([loggingMiddleware]) // Same middleware as in requestMiddleware - should be deduped
  .handler(async ({ context }) => {
    const counts = getMiddlewareExecutionCounts()

    return {
      success: true,
      loggingMiddlewareExecuted: (context as any).loggingMiddlewareExecuted,
      globalMiddlewareExecuted: (context as any).globalMiddlewareExecuted,
      globalMiddleware2Executed: (context as any).globalMiddleware2Executed,
      middlewareExecutionCounts: counts,
    }
  })

export const Route = createFileRoute('/simple')({
  loader: async () => {
    const result = await simpleServerFn()
    return result
  },
  component: SimpleComponent,
})

function SimpleComponent() {
  const data = Route.useLoaderData()

  // Check loggingMiddleware count
  // loggingMiddleware is in BOTH requestMiddleware AND server function middleware
  // With proper deduplication, it should only run once total for this request
  const loggingCount = data.middlewareExecutionCounts['loggingMiddleware'] || 0
  const globalCount =
    data.middlewareExecutionCounts['globalFunctionMiddleware'] || 0
  const global2Count =
    data.middlewareExecutionCounts['globalFunctionMiddleware2'] || 0

  // Expected: loggingMiddleware runs once (deduped across request and function middleware)
  // globalFunctionMiddleware and globalFunctionMiddleware2 each run once
  const expectedLoggingCount = 1 // Should be deduped
  const expectedGlobalCount = 1
  const expectedGlobal2Count = 1

  const isDeduped =
    loggingCount === expectedLoggingCount &&
    globalCount === expectedGlobalCount &&
    global2Count === expectedGlobal2Count

  return (
    <div className="p-8">
      <h1 className="font-bold text-lg mb-4">
        Simple Global Middleware Test (Issue #5239)
      </h1>

      <div className="mb-4">
        <h2 className="font-semibold">Test Result:</h2>
        <div
          data-testid="deduplication-status"
          className={isDeduped ? 'text-green-600' : 'text-red-600'}
        >
          {isDeduped
            ? 'PASS: Middleware was deduped correctly'
            : 'FAIL: Middleware executed multiple times'}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Middleware Execution Counts:</h2>
        <pre data-testid="execution-counts" className="bg-gray-100 p-2 rounded">
          {JSON.stringify(data.middlewareExecutionCounts, null, 2)}
        </pre>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Context Values:</h2>
        <div>
          <span>loggingMiddlewareExecuted: </span>
          <span data-testid="logging-middleware-executed">
            {String(data.loggingMiddlewareExecuted)}
          </span>
        </div>
        <div>
          <span>globalMiddlewareExecuted: </span>
          <span data-testid="global-middleware-executed">
            {String(data.globalMiddlewareExecuted)}
          </span>
        </div>
        <div>
          <span>globalMiddleware2Executed: </span>
          <span data-testid="global-middleware-2-executed">
            {String(data.globalMiddleware2Executed)}
          </span>
        </div>
      </div>

      <div className="text-sm text-gray-500">
        <p data-testid="logging-count">
          Logging Middleware Count: {loggingCount}
        </p>
        <p data-testid="global-count">Global Middleware Count: {globalCount}</p>
        <p data-testid="global-2-count">
          Global Middleware 2 Count: {global2Count}
        </p>
      </div>

      {/* Hidden test values for e2e */}
      <div className="hidden">
        <span data-testid="expected-logging-count">{expectedLoggingCount}</span>
        <span data-testid="expected-global-count">{expectedGlobalCount}</span>
        <span data-testid="expected-global-2-count">
          {expectedGlobal2Count}
        </span>
      </div>
    </div>
  )
}
