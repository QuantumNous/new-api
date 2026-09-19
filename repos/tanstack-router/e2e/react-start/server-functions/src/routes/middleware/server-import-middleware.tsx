import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import React from 'react'

/**
 * This test verifies that server-only imports (like getRequestHeaders from @tanstack/react-start/server)
 * are properly removed from the client bundle when used inside createMiddleware().server().
 *
 * If the .server() part is not stripped from the client build, this will fail with:
 * "Module node:async_hooks has been externalized for browser compatibility"
 * because @tanstack/react-start/server uses node:async_hooks internally.
 */
const serverImportMiddleware = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    // Use a server-only import - this should be stripped from client build
    const headers = getRequestHeaders()
    const testHeader = headers.get('x-test-middleware') ?? 'missing'

    console.log('[server-import-middleware] X-Test-Middleware:', testHeader)

    return next({
      context: {
        testHeader,
      },
    })
  },
)

const serverFn = createServerFn()
  .middleware([serverImportMiddleware])
  .handler(async ({ context }) => {
    return { testHeader: context.testHeader }
  })

export const Route = createFileRoute('/middleware/server-import-middleware')({
  component: RouteComponent,
})

function RouteComponent() {
  const [result, setResult] = React.useState<{ testHeader: string } | null>(
    null,
  )
  const [error, setError] = React.useState<string | null>(null)

  async function handleClick() {
    try {
      const data = await serverFn({
        headers: { 'x-test-middleware': 'test-header-value' },
      })
      setResult(data)
      setError(null)
    } catch (e) {
      setResult(null)
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div>
      <h2>Server Import in Middleware Test</h2>
      <p>
        This test verifies that server-only imports (getRequestHeaders) inside
        createMiddleware().server() are properly stripped from the client build.
      </p>
      <button
        onClick={handleClick}
        data-testid="test-server-import-middleware-btn"
      >
        Call server function with middleware
      </button>
      {result && (
        <div data-testid="server-import-middleware-result">
          {result.testHeader}
        </div>
      )}
      {error && (
        <div data-testid="server-import-middleware-error">Error: {error}</div>
      )}
    </div>
  )
}
