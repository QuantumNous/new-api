import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequestHeaders } from '@tanstack/react-start/server'
import React from 'react'

/**
 * This test verifies that middleware factories (functions that return createMiddleware().server())
 * have their server-only code properly stripped from the client bundle.
 *
 * If the .server() part inside the factory is not stripped from the client build, this will fail with:
 * "Module node:async_hooks has been externalized for browser compatibility"
 * because @tanstack/react-start/server uses node:async_hooks internally.
 */

// Middleware factory function - returns a middleware with .server() call
function createHeaderMiddleware(headerName: string) {
  return createMiddleware({ type: 'function' }).server(async ({ next }) => {
    // Use a server-only import - this should be stripped from client build
    const headers = getRequestHeaders()
    const headerValue = headers.get(headerName) ?? 'missing'

    console.log(`[middleware-factory] ${headerName}:`, headerValue)

    return next({
      context: {
        headerName,
        headerValue,
      },
    })
  })
}

// Arrow function factory variant
const createPrefixedHeaderMiddleware = (prefix: string) => {
  return createMiddleware({ type: 'function' }).server(async ({ next }) => {
    // Use a server-only import - this should be stripped from client build
    const headers = getRequestHeaders()
    const allHeaderNames = [...headers.keys()]
    const prefixedHeaders = allHeaderNames.filter((name) =>
      name.toLowerCase().startsWith(prefix.toLowerCase()),
    )

    console.log(
      `[middleware-factory] Prefixed headers (${prefix}):`,
      prefixedHeaders,
    )

    return next({
      context: {
        prefix,
        matchedHeaders: prefixedHeaders,
      },
    })
  })
}

// Create middleware instances using the factories
const customHeaderMiddleware = createHeaderMiddleware('x-custom-factory-header')
const prefixedMiddleware = createPrefixedHeaderMiddleware('x-factory-')

const serverFn = createServerFn()
  .middleware([customHeaderMiddleware, prefixedMiddleware])
  .handler(async ({ context }) => {
    return {
      headerName: context.headerName,
      headerValue: context.headerValue,
      prefix: context.prefix,
      matchedHeaders: context.matchedHeaders,
    }
  })

export const Route = createFileRoute('/middleware/middleware-factory')({
  component: RouteComponent,
})

function RouteComponent() {
  const [result, setResult] = React.useState<{
    headerName: string
    headerValue: string
    prefix: string
    matchedHeaders: Array<string>
  } | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  async function handleClick() {
    try {
      const data = await serverFn({
        headers: {
          'x-custom-factory-header': 'factory-header-value',
          'x-factory-one': 'one',
          'x-factory-two': 'two',
        },
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
      <h2>Middleware Factory Test</h2>
      <p>
        This test verifies that middleware factories (functions returning
        createMiddleware().server()) have their server-only code properly
        stripped from the client build.
      </p>
      <button onClick={handleClick} data-testid="test-middleware-factory-btn">
        Call server function with factory middlewares
      </button>
      {result && (
        <div data-testid="middleware-factory-result">
          <div data-testid="header-value">{result.headerValue}</div>
          <div data-testid="matched-headers">
            {result.matchedHeaders.join(',')}
          </div>
        </div>
      )}
      {error && (
        <div data-testid="middleware-factory-error">Error: {error}</div>
      )}
    </div>
  )
}
