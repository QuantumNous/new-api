import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn, createMiddleware } from '@tanstack/react-start'
import {
  globalFunctionMiddleware,
  loggingMiddleware,
  getMiddlewareExecutionCounts,
  trackMiddlewareExecution,
} from '~/start'

// Local middleware that should also be tracked
const localMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    trackMiddlewareExecution('localMiddleware')
    return next({
      context: {
        localMiddlewareExecuted: true,
      },
    })
  },
)

// Server function 1 - uses global middleware (implicit from start.ts)
// Plus explicitly adds globalFunctionMiddleware again (should be deduped)
const serverFn1 = createServerFn()
  .middleware([globalFunctionMiddleware])
  .handler(async ({ context }) => {
    const counts = getMiddlewareExecutionCounts()
    return {
      fn: 'serverFn1',
      globalMiddlewareExecuted: (context as any).globalMiddlewareExecuted,
      // Return counts for this specific request
      counts,
    }
  })

// Server function 2 - uses global middleware plus local middleware
const serverFn2 = createServerFn()
  .middleware([globalFunctionMiddleware, localMiddleware])
  .handler(async ({ context }) => {
    const counts = getMiddlewareExecutionCounts()
    return {
      fn: 'serverFn2',
      globalMiddlewareExecuted: (context as any).globalMiddlewareExecuted,
      localMiddlewareExecuted: (context as any).localMiddlewareExecuted,
      counts,
    }
  })

// Server function 3 - uses loggingMiddleware (which is in requestMiddleware)
// plus local middleware
const serverFn3 = createServerFn()
  .middleware([loggingMiddleware, localMiddleware])
  .handler(async ({ context }) => {
    const counts = getMiddlewareExecutionCounts()
    return {
      fn: 'serverFn3',
      loggingMiddlewareExecuted: (context as any).loggingMiddlewareExecuted,
      localMiddlewareExecuted: (context as any).localMiddlewareExecuted,
      counts,
    }
  })

// Final server function to get execution counts after all others have run
const getExecutionCountsFn = createServerFn().handler(async () => {
  const counts = getMiddlewareExecutionCounts()
  return { counts }
})

export const Route = createFileRoute('/multiple-server-functions')({
  loader: async () => {
    // Call multiple server functions in the same request
    // Each one has global middleware, but it should only execute once per function call
    // The BUG is that global middleware executes multiple times per function call
    const [result1, result2, result3] = await Promise.all([
      serverFn1(),
      serverFn2(),
      serverFn3(),
    ])

    // Get the final execution counts
    const executionData = await getExecutionCountsFn()

    return {
      results: [result1, result2, result3],
      executionCounts: executionData.counts,
    }
  },
  component: MultipleServerFunctionsComponent,
})

function MultipleServerFunctionsComponent() {
  const data = Route.useLoaderData()

  // For SSR: all functions run in same request, counts accumulate
  // For client-side: each function is separate request, counts are per-request
  //
  // What we're testing is deduplication WITHIN each server function call:
  // - loggingMiddleware is in requestMiddleware AND serverFn3 - should run once per request
  // - globalFunctionMiddleware is in functionMiddleware AND explicitly added - should run once per fn
  //
  // For SSR mode (accumulating counts):
  // - loggingMiddleware: 1 (runs in request middleware, deduped in serverFn3)
  // - globalFunctionMiddleware: 4 (once per server function call)
  // - globalFunctionMiddleware2: 4 (once per server function call)
  // - localMiddleware: 2 (serverFn2 and serverFn3)
  //
  // For client-side mode: we verify each function's individual counts show deduplication worked

  const loggingCount = data.executionCounts['loggingMiddleware'] || 0
  const globalCount = data.executionCounts['globalFunctionMiddleware'] || 0
  const global2Count = data.executionCounts['globalFunctionMiddleware2'] || 0
  const localCount = data.executionCounts['localMiddleware'] || 0

  // Detect if we're in SSR mode by checking if counts are > 1
  // (In client-side, last request is getExecutionCountsFn which only has global middlewares)
  const isSSRMode = globalCount > 1

  // Expected counts for SSR mode
  const expectedLoggingCountSSR = 1
  const expectedGlobalCountSSR = 4
  const expectedGlobal2CountSSR = 4
  const expectedLocalCountSSR = 2

  // Expected counts for client-side mode (last request only has global middlewares running once)
  const expectedLoggingCountClient = 1
  const expectedGlobalCountClient = 1
  const expectedGlobal2CountClient = 1
  const expectedLocalCountClient = 0 // not in getExecutionCountsFn

  const expectedLoggingCount = isSSRMode
    ? expectedLoggingCountSSR
    : expectedLoggingCountClient
  const expectedGlobalCount = isSSRMode
    ? expectedGlobalCountSSR
    : expectedGlobalCountClient
  const expectedGlobal2Count = isSSRMode
    ? expectedGlobal2CountSSR
    : expectedGlobal2CountClient
  const expectedLocalCount = isSSRMode
    ? expectedLocalCountSSR
    : expectedLocalCountClient

  // For client-side, also verify that individual function results show correct deduplication
  // Each function should have its middlewares run exactly once PER REQUEST
  // Note: In SSR mode, all functions share the same counts (accumulated), so we skip these checks
  const fn1Counts = (data.results[0] as any).counts || {}
  const fn2Counts = (data.results[1] as any).counts || {}
  const fn3Counts = (data.results[2] as any).counts || {}

  // Per-function deduplication check - only valid for client-side mode
  // In SSR, all functions run in same request, so counts accumulate
  // In client-side, each function is a separate request, so counts are per-request
  let perFunctionDedupeOk = true
  if (!isSSRMode) {
    // serverFn1: globalFunctionMiddleware=1, globalFunctionMiddleware2=1, loggingMiddleware=1
    // serverFn2: adds localMiddleware=1
    // serverFn3: loggingMiddleware=1 (deduped with request middleware), localMiddleware=1
    const fn1GlobalOk = fn1Counts['globalFunctionMiddleware'] === 1
    const fn1Global2Ok = fn1Counts['globalFunctionMiddleware2'] === 1
    const fn2LocalOk = fn2Counts['localMiddleware'] === 1
    const fn3LoggingOk = fn3Counts['loggingMiddleware'] === 1 // deduped with request middleware

    perFunctionDedupeOk =
      fn1GlobalOk && fn1Global2Ok && fn2LocalOk && fn3LoggingOk
  }

  const isLoggingCorrect = loggingCount === expectedLoggingCount
  const isGlobalDeduped = globalCount === expectedGlobalCount
  const isGlobal2Deduped = global2Count === expectedGlobal2Count
  const isLocalCorrect = localCount === expectedLocalCount

  const allPassed = isSSRMode
    ? isLoggingCorrect &&
      isGlobalDeduped &&
      isGlobal2Deduped &&
      isLocalCorrect &&
      perFunctionDedupeOk
    : perFunctionDedupeOk // For client-side, just verify per-function deduplication

  return (
    <div className="p-8">
      <h1 className="font-bold text-lg mb-4">
        Multiple Server Functions with Global Middleware (Issue #5239)
      </h1>

      <div className="mb-4">
        <Link to="/" className="text-blue-600 underline">
          ← Back to Home
        </Link>
      </div>

      <div className="mb-2 text-sm text-gray-500">
        Mode: {isSSRMode ? 'SSR (direct navigation)' : 'Client-side navigation'}
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Overall Test Result:</h2>
        <div
          data-testid="overall-status"
          className={allPassed ? 'text-green-600' : 'text-red-600'}
        >
          {allPassed
            ? 'PASS: All middlewares executed correct number of times'
            : 'FAIL: Middleware execution counts are incorrect'}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">
          Middleware Execution Counts (Final Request):
        </h2>
        <table className="border-collapse border border-gray-300">
          <thead>
            <tr>
              <th className="border border-gray-300 p-2">Middleware</th>
              <th className="border border-gray-300 p-2">Expected</th>
              <th className="border border-gray-300 p-2">Actual</th>
              <th className="border border-gray-300 p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-gray-300 p-2">loggingMiddleware</td>
              <td
                className="border border-gray-300 p-2"
                data-testid="expected-logging-count"
              >
                {expectedLoggingCount}
              </td>
              <td
                className="border border-gray-300 p-2"
                data-testid="actual-logging-count"
              >
                {loggingCount}
              </td>
              <td
                className="border border-gray-300 p-2"
                data-testid="logging-status"
              >
                {isLoggingCorrect ? '✓' : '✗'}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2">
                globalFunctionMiddleware
              </td>
              <td
                className="border border-gray-300 p-2"
                data-testid="expected-global-count"
              >
                {expectedGlobalCount}
              </td>
              <td
                className="border border-gray-300 p-2"
                data-testid="actual-global-count"
              >
                {globalCount}
              </td>
              <td
                className="border border-gray-300 p-2"
                data-testid="global-status"
              >
                {isGlobalDeduped ? '✓' : '✗'}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2">
                globalFunctionMiddleware2
              </td>
              <td
                className="border border-gray-300 p-2"
                data-testid="expected-global-2-count"
              >
                {expectedGlobal2Count}
              </td>
              <td
                className="border border-gray-300 p-2"
                data-testid="actual-global-2-count"
              >
                {global2Count}
              </td>
              <td
                className="border border-gray-300 p-2"
                data-testid="global-2-status"
              >
                {isGlobal2Deduped ? '✓' : '✗'}
              </td>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2">localMiddleware</td>
              <td
                className="border border-gray-300 p-2"
                data-testid="expected-local-count"
              >
                {expectedLocalCount}
              </td>
              <td
                className="border border-gray-300 p-2"
                data-testid="actual-local-count"
              >
                {localCount}
              </td>
              <td
                className="border border-gray-300 p-2"
                data-testid="local-status"
              >
                {isLocalCorrect ? '✓' : '✗'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Per-Function Deduplication Check:</h2>
        <div className="text-sm">
          {isSSRMode ? (
            <div>
              (In SSR mode, all functions share the same request context, so
              per-function checks are skipped)
            </div>
          ) : (
            <>
              <div>
                serverFn1 globalFunctionMiddleware=1:{' '}
                {fn1Counts['globalFunctionMiddleware'] === 1
                  ? '✓'
                  : '✗ got ' + fn1Counts['globalFunctionMiddleware']}
              </div>
              <div>
                serverFn1 globalFunctionMiddleware2=1:{' '}
                {fn1Counts['globalFunctionMiddleware2'] === 1
                  ? '✓'
                  : '✗ got ' + fn1Counts['globalFunctionMiddleware2']}
              </div>
              <div>
                serverFn2 localMiddleware=1:{' '}
                {fn2Counts['localMiddleware'] === 1
                  ? '✓'
                  : '✗ got ' + fn2Counts['localMiddleware']}
              </div>
              <div>
                serverFn3 loggingMiddleware=1 (deduped):{' '}
                {fn3Counts['loggingMiddleware'] === 1
                  ? '✓'
                  : '✗ got ' + fn3Counts['loggingMiddleware']}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Server Function Results:</h2>
        <pre
          data-testid="server-fn-results"
          className="bg-gray-100 p-2 rounded text-sm"
        >
          {JSON.stringify(data.results, null, 2)}
        </pre>
      </div>

      <div className="mb-4">
        <h2 className="font-semibold">Raw Execution Counts (Final Request):</h2>
        <pre
          data-testid="raw-execution-counts"
          className="bg-gray-100 p-2 rounded text-sm"
        >
          {JSON.stringify(data.executionCounts, null, 2)}
        </pre>
      </div>
    </div>
  )
}
