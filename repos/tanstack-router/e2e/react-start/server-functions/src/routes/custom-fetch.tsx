import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import type { CustomFetch } from '@tanstack/react-start'

/**
 * Custom Fetch Implementation Tests
 *
 * This route tests the custom fetch feature for server functions. Users can provide
 * a custom `fetch` implementation to control how server function requests are made.
 *
 * ## Fetch Override Precedence (highest to lowest priority):
 *
 * 1. **Direct call-site fetch** - When `serverFn({ fetch: customFetch })` is called,
 *    this fetch takes highest priority and overrides any middleware fetch.
 *
 * 2. **Later middleware fetch** - When multiple middlewares provide fetch, the LAST
 *    middleware in the chain wins. Middleware is executed in order, and each call to
 *    `next({ fetch })` can override the previous fetch.
 *
 * 3. **Earlier middleware fetch** - Middlewares earlier in the chain have lower priority.
 *    Their fetch will be used only if no later middleware or direct call provides one.
 *
 * 4. **Global serverFnFetch** - When `createStart({ serverFnFetch })` is configured,
 *    it's used if no middleware or call-site fetch is provided.
 *
 * 5. **Default global fetch** - If no custom fetch is provided anywhere, the global
 *    `fetch` function is used.
 *
 * ## Why This Design?
 *
 * - **Direct call wins**: Gives maximum control to the call site. Users can always
 *   override middleware behavior when needed for specific use cases.
 *
 * - **Later middleware wins**: Follows the middleware chain execution order. Each
 *   middleware can see and override what previous middlewares set, similar to how
 *   middleware can modify context or headers.
 *
 * - **Global serverFnFetch**: Provides a default for all server functions that can
 *   still be overridden per-function or per-call.
 *
 * - **Fallback to default**: Ensures backward compatibility. Existing code without
 *   custom fetch continues to work as expected.
 */

export const Route = createFileRoute('/custom-fetch')({
  component: CustomFetchComponent,
})

/**
 * Basic server function that returns all request headers.
 * Used to verify which custom fetch implementation was actually used
 * by checking for the presence of custom headers.
 */
const getHeaders = createServerFn().handler(() => {
  return Object.fromEntries(getRequestHeaders().entries())
})

/**
 * Middleware that injects 'x-custom-fetch-middleware: true' header.
 *
 * When used alone, this header should appear in the request.
 * When a direct call-site fetch is also provided, this middleware's fetch
 * should be OVERRIDDEN and this header should NOT appear.
 */
const customFetchMiddleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const customFetch: CustomFetch = (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set('x-custom-fetch-middleware', 'true')
      return fetch(input, { ...init, headers })
    }
    return next({ fetch: customFetch })
  },
)

/**
 * Server function using middleware for custom fetch.
 *
 * Expected behavior:
 * - When called without options: Uses customFetchMiddleware's fetch
 *   → Request should have 'x-custom-fetch-middleware: true'
 * - When called with { fetch: directFetch }: Direct fetch overrides middleware
 *   → Request should NOT have 'x-custom-fetch-middleware'
 */
const getHeadersWithMiddleware = createServerFn()
  .middleware([customFetchMiddleware])
  .handler(() => {
    return Object.fromEntries(getRequestHeaders().entries())
  })

/**
 * First middleware in a chain - sets 'x-middleware-first: true' header.
 *
 * This middleware runs BEFORE secondMiddleware in the chain.
 * Its fetch should be OVERRIDDEN by secondMiddleware's fetch.
 */
const firstMiddleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const customFetch: CustomFetch = (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set('x-middleware-first', 'true')
      return fetch(input, { ...init, headers })
    }
    return next({ fetch: customFetch })
  },
)

/**
 * Second middleware in a chain - sets 'x-middleware-second: true' header.
 *
 * This middleware runs AFTER firstMiddleware in the chain.
 * Its fetch should WIN and override firstMiddleware's fetch because
 * later middlewares take precedence.
 */
const secondMiddleware = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const customFetch: CustomFetch = (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set('x-middleware-second', 'true')
      return fetch(input, { ...init, headers })
    }
    return next({ fetch: customFetch })
  },
)

/**
 * Server function with chained middleware: [firstMiddleware, secondMiddleware]
 *
 * Expected behavior:
 * - secondMiddleware's fetch WINS (later middleware overrides earlier)
 * - Request should have 'x-middleware-second: true'
 * - Request should NOT have 'x-middleware-first' (overridden)
 *
 * Execution order:
 * 1. firstMiddleware sets its fetch, calls next({ fetch: firstFetch })
 * 2. secondMiddleware sets its fetch, calls next({ fetch: secondFetch })
 * 3. secondFetch overrides firstFetch because it came later
 * 4. Actual request uses secondFetch
 */
const getHeadersWithChainedMiddleware = createServerFn()
  .middleware([firstMiddleware, secondMiddleware])
  .handler(() => {
    return Object.fromEntries(getRequestHeaders().entries())
  })

/**
 * Server function with middleware that can be overridden by direct call.
 *
 * Expected behavior:
 * - When called with { fetch: directFetch }: Direct fetch WINS
 *   → Request should have 'x-direct-override: true'
 *   → Request should NOT have 'x-custom-fetch-middleware' (overridden)
 *
 * This tests the highest priority rule: direct call-site fetch always wins
 * over any middleware-provided fetch.
 */
const getHeadersWithOverridableMiddleware = createServerFn()
  .middleware([customFetchMiddleware])
  .handler(() => {
    return Object.fromEntries(getRequestHeaders().entries())
  })

function CustomFetchComponent() {
  const [directResult, setDirectResult] = React.useState<Record<
    string,
    string
  > | null>(null)
  const [middlewareResult, setMiddlewareResult] = React.useState<Record<
    string,
    string
  > | null>(null)
  const [chainedResult, setChainedResult] = React.useState<Record<
    string,
    string
  > | null>(null)
  const [overrideResult, setOverrideResult] = React.useState<Record<
    string,
    string
  > | null>(null)
  const [noCustomFetchResult, setNoCustomFetchResult] = React.useState<Record<
    string,
    string
  > | null>(null)
  const [globalFetchResult, setGlobalFetchResult] = React.useState<Record<
    string,
    string
  > | null>(null)
  const [middlewareOverridesGlobalResult, setMiddlewareOverridesGlobalResult] =
    React.useState<Record<string, string> | null>(null)
  const [directOverridesGlobalResult, setDirectOverridesGlobalResult] =
    React.useState<Record<string, string> | null>(null)

  /**
   * Test 1: Direct Custom Fetch
   *
   * Passes a custom fetch directly at the call site to a server function
   * that has NO middleware.
   *
   * Expected: 'x-custom-fetch-direct: true' header should be present
   * Precedence: Direct fetch is the only fetch configured → it wins
   */
  const handleDirectFetch = async () => {
    const customFetch: CustomFetch = (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set('x-custom-fetch-direct', 'true')
      return fetch(input, { ...init, headers })
    }
    const result = await getHeaders({ fetch: customFetch })
    setDirectResult(result)
  }

  /**
   * Test 2: Middleware Custom Fetch
   *
   * Calls a server function that has middleware providing custom fetch.
   * No direct fetch is passed at the call site.
   *
   * Expected: 'x-custom-fetch-middleware: true' header should be present
   * Precedence: Middleware fetch is the only fetch configured → it wins
   */
  const handleMiddlewareFetch = async () => {
    const result = await getHeadersWithMiddleware()
    setMiddlewareResult(result)
  }

  /**
   * Test 3: Chained Middleware - Later Overrides Earlier
   *
   * Calls a server function with TWO middlewares, each providing custom fetch:
   * - firstMiddleware sets 'x-middleware-first: true'
   * - secondMiddleware sets 'x-middleware-second: true'
   *
   * Expected:
   * - 'x-middleware-second: true' SHOULD be present (later middleware wins)
   * - 'x-middleware-first' should NOT be present (overridden by later middleware)
   *
   * Precedence: [firstMiddleware, secondMiddleware] → secondMiddleware wins
   */
  const handleChainedMiddlewareFetch = async () => {
    const result = await getHeadersWithChainedMiddleware()
    setChainedResult(result)
  }

  /**
   * Test 4: Direct Fetch Overrides Middleware Fetch
   *
   * Calls a server function that has middleware providing custom fetch,
   * BUT also passes a direct fetch at the call site.
   *
   * Expected:
   * - 'x-direct-override: true' SHOULD be present (direct call wins)
   * - 'x-custom-fetch-middleware' should NOT be present (overridden by direct)
   *
   * Precedence: Direct call > Middleware → Direct wins
   *
   * This is the most important override test: it verifies that users can
   * always override middleware behavior at the call site when needed.
   */
  const handleOverrideFetch = async () => {
    const customFetch: CustomFetch = (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set('x-direct-override', 'true')
      return fetch(input, { ...init, headers })
    }
    const result = await getHeadersWithOverridableMiddleware({
      fetch: customFetch,
    })
    setOverrideResult(result)
  }

  /**
   * Test 5: No Custom Fetch (Default Behavior)
   *
   * Calls a server function with NO middleware and NO direct fetch.
   * This tests the fallback to the global serverFnFetch from createStart.
   *
   * Expected:
   * - 'x-global-fetch: true' SHOULD be present (from createStart serverFnFetch)
   * - Neither 'x-custom-fetch-direct' nor 'x-custom-fetch-middleware' should be present
   * - Request should succeed using the global fetch from start.ts
   *
   * Precedence: No call-site or middleware fetch → Global serverFnFetch is used
   */
  const handleNoCustomFetch = async () => {
    const result = await getHeaders()
    setNoCustomFetchResult(result)
  }

  /**
   * Test 6: Global Fetch from createStart
   *
   * Calls a server function with NO middleware and NO direct fetch.
   * Verifies that the global serverFnFetch from createStart is used.
   *
   * Expected:
   * - 'x-global-fetch: true' SHOULD be present (from createStart serverFnFetch)
   *
   * This explicitly tests the global serverFnFetch feature.
   */
  const handleGlobalFetch = async () => {
    const result = await getHeaders()
    setGlobalFetchResult(result)
  }

  /**
   * Test 7: Middleware Overrides Global Fetch
   *
   * Calls a server function with middleware that provides custom fetch.
   * Verifies that middleware fetch takes precedence over global serverFnFetch.
   *
   * Expected:
   * - 'x-custom-fetch-middleware: true' SHOULD be present (middleware wins)
   * - 'x-global-fetch' should NOT be present (overridden by middleware)
   *
   * Precedence: Middleware > Global serverFnFetch
   */
  const handleMiddlewareOverridesGlobal = async () => {
    const result = await getHeadersWithMiddleware()
    setMiddlewareOverridesGlobalResult(result)
  }

  /**
   * Test 8: Direct Fetch Overrides Global Fetch
   *
   * Calls a server function with direct fetch at call site.
   * Verifies that call-site fetch takes precedence over global serverFnFetch.
   *
   * Expected:
   * - 'x-direct-override-global: true' SHOULD be present (call-site wins)
   * - 'x-global-fetch' should NOT be present (overridden by call-site)
   *
   * Precedence: Call-site > Global serverFnFetch
   */
  const handleDirectOverridesGlobal = async () => {
    const customFetch: CustomFetch = (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set('x-direct-override-global', 'true')
      return fetch(input, { ...init, headers })
    }
    const result = await getHeaders({ fetch: customFetch })
    setDirectOverridesGlobalResult(result)
  }

  return (
    <div className="p-2 m-2 grid gap-4">
      <h3>Custom Fetch Implementation Test</h3>
      <p className="text-sm text-gray-600">
        Tests custom fetch override precedence: Direct call &gt; Later
        middleware &gt; Earlier middleware &gt; Global serverFnFetch &gt;
        Default fetch
      </p>

      <div>
        <h4>Test 1: Direct Custom Fetch</h4>
        <p className="text-xs text-gray-500">
          Expected: x-custom-fetch-direct header present
        </p>
        <button
          type="button"
          data-testid="test-direct-custom-fetch-btn"
          onClick={handleDirectFetch}
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Test Direct Custom Fetch
        </button>
        <pre data-testid="direct-custom-fetch-result">
          {directResult ? JSON.stringify(directResult, null, 2) : 'null'}
        </pre>
      </div>

      <div>
        <h4>Test 2: Middleware Custom Fetch</h4>
        <p className="text-xs text-gray-500">
          Expected: x-custom-fetch-middleware header present
        </p>
        <button
          type="button"
          data-testid="test-middleware-custom-fetch-btn"
          onClick={handleMiddlewareFetch}
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Test Middleware Custom Fetch
        </button>
        <pre data-testid="middleware-custom-fetch-result">
          {middlewareResult
            ? JSON.stringify(middlewareResult, null, 2)
            : 'null'}
        </pre>
      </div>

      <div>
        <h4>Test 3: Chained Middleware (Later Wins)</h4>
        <p className="text-xs text-gray-500">
          Expected: x-middleware-second present, x-middleware-first NOT present
        </p>
        <button
          type="button"
          data-testid="test-chained-middleware-btn"
          onClick={handleChainedMiddlewareFetch}
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Test Chained Middleware
        </button>
        <pre data-testid="chained-middleware-result">
          {chainedResult ? JSON.stringify(chainedResult, null, 2) : 'null'}
        </pre>
      </div>

      <div>
        <h4>Test 4: Direct Overrides Middleware</h4>
        <p className="text-xs text-gray-500">
          Expected: x-direct-override present, x-custom-fetch-middleware NOT
          present
        </p>
        <button
          type="button"
          data-testid="test-direct-override-btn"
          onClick={handleOverrideFetch}
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Test Direct Override
        </button>
        <pre data-testid="direct-override-result">
          {overrideResult ? JSON.stringify(overrideResult, null, 2) : 'null'}
        </pre>
      </div>

      <div>
        <h4>Test 5: No Custom Fetch (Uses Global)</h4>
        <p className="text-xs text-gray-500">
          Expected: x-global-fetch header present (from createStart
          serverFnFetch)
        </p>
        <button
          type="button"
          data-testid="test-no-custom-fetch-btn"
          onClick={handleNoCustomFetch}
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Test No Custom Fetch
        </button>
        <pre data-testid="no-custom-fetch-result">
          {noCustomFetchResult
            ? JSON.stringify(noCustomFetchResult, null, 2)
            : 'null'}
        </pre>
      </div>

      <div>
        <h4>Test 6: Global Fetch from createStart</h4>
        <p className="text-xs text-gray-500">
          Expected: x-global-fetch header present
        </p>
        <button
          type="button"
          data-testid="test-global-fetch-btn"
          onClick={handleGlobalFetch}
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Test Global Fetch
        </button>
        <pre data-testid="global-fetch-result">
          {globalFetchResult
            ? JSON.stringify(globalFetchResult, null, 2)
            : 'null'}
        </pre>
      </div>

      <div>
        <h4>Test 7: Middleware Overrides Global Fetch</h4>
        <p className="text-xs text-gray-500">
          Expected: x-custom-fetch-middleware present, x-global-fetch NOT
          present
        </p>
        <button
          type="button"
          data-testid="test-middleware-overrides-global-btn"
          onClick={handleMiddlewareOverridesGlobal}
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Test Middleware Overrides Global
        </button>
        <pre data-testid="middleware-overrides-global-result">
          {middlewareOverridesGlobalResult
            ? JSON.stringify(middlewareOverridesGlobalResult, null, 2)
            : 'null'}
        </pre>
      </div>

      <div>
        <h4>Test 8: Direct Fetch Overrides Global Fetch</h4>
        <p className="text-xs text-gray-500">
          Expected: x-direct-override-global present, x-global-fetch NOT present
        </p>
        <button
          type="button"
          data-testid="test-direct-overrides-global-btn"
          onClick={handleDirectOverridesGlobal}
          className="rounded-md bg-white px-2.5 py-1.5 text-sm font-semibold text-gray-900 shadow-xs ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          Test Direct Overrides Global
        </button>
        <pre data-testid="direct-overrides-global-result">
          {directOverridesGlobalResult
            ? JSON.stringify(directOverridesGlobalResult, null, 2)
            : 'null'}
        </pre>
      </div>
    </div>
  )
}
