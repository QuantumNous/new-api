import { createFileRoute } from '@tanstack/react-router'
import { createMiddleware, createServerFn } from '@tanstack/react-start'
import React from 'react'

// Request middleware that captures serverFnMeta
// Note: Request middleware only runs server-side, so it receives full ServerFnMeta
// serverFnMeta is only present for server function calls, undefined for regular page requests
const requestMetadataMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next, serverFnMeta }) => {
    return next({
      context: {
        requestCapturedMeta: serverFnMeta,
      },
    })
  },
)

// Separate request middleware for route-level server middleware
// This will receive serverFnMeta as undefined for page requests
const pageRequestMiddleware = createMiddleware({ type: 'request' }).server(
  async ({ next, serverFnMeta }) => {
    return next({
      context: {
        // For page requests (not server function calls), serverFnMeta should be undefined
        // We use '$undefined' string to prove we actually executed and passed data through
        pageRequestServerFnMeta:
          serverFnMeta === undefined ? '$undefined' : serverFnMeta,
      },
    })
  },
)

const metadataMiddleware = createMiddleware({ type: 'function' })
  .middleware([requestMetadataMiddleware])
  .client(async ({ next, serverFnMeta }) => {
    return next({
      sendContext: {
        clientCapturedMeta: serverFnMeta,
      },
    })
  })
  .server(async ({ next, serverFnMeta, context }) => {
    return next({
      context: {
        serverCapturedMeta: serverFnMeta,
        clientCapturedMeta: context.clientCapturedMeta,
        requestCapturedMeta: context.requestCapturedMeta,
      },
    })
  })

// Server function that returns client, server, and request captured metadata
const getMetadataFn = createServerFn()
  .middleware([metadataMiddleware])
  .handler(async ({ context }) => {
    return {
      // Full metadata captured by server middleware
      serverMeta: context.serverCapturedMeta,
      // Metadata captured by client middleware and sent via sendContext
      // Client middleware only has { id }, not { name, filename }
      clientCapturedMeta: context.clientCapturedMeta,
      // Metadata captured by request middleware
      // Request middleware receives full ServerFnMeta for server function calls
      // or undefined for regular page requests
      requestCapturedMeta: context.requestCapturedMeta,
    }
  })

export const Route = createFileRoute('/middleware/function-metadata')({
  // Server route configuration to test that serverFnMeta is undefined for page requests
  server: {
    middleware: [pageRequestMiddleware],
    handlers: {
      GET: async ({ next, context }) => {
        // Pass the captured serverFnMeta (should be undefined for page requests) to serverContext
        return next({
          context: {
            pageRequestServerFnMeta: context.pageRequestServerFnMeta,
          },
        })
      },
    },
  },
  // Access serverContext in beforeLoad to pass to route context
  beforeLoad: async ({ serverContext }) => {
    return {
      // serverContext contains data from GET handler + middleware context
      // For page requests, pageRequestServerFnMeta should be undefined
      pageRequestServerFnMeta: serverContext?.pageRequestServerFnMeta,
    }
  },
  loader: () => getMetadataFn(),
  component: RouteComponent,
})

function RouteComponent() {
  const loaderData = Route.useLoaderData()
  const routeContext = Route.useRouteContext()

  const [clientData, setClientData] = React.useState<typeof loaderData | null>(
    null,
  )

  return (
    <div>
      <h2>Function Metadata in Middleware</h2>
      <p>
        This test verifies that client, server, and request middleware receive
        serverFnMeta in their options. Client middleware gets only the id, while
        server and request middleware get the full metadata (id, name,
        filename). Request middleware only receives serverFnMeta for server
        function calls, not for regular page requests.
      </p>
      <br />
      <div>
        <div data-testid="page-request-data">
          <h3>Page Request Middleware Data (via serverContext)</h3>
          <p>
            For regular page requests (not server function calls), serverFnMeta
            should be undefined:
          </p>
          <div>
            Page Request serverFnMeta:{' '}
            <span data-testid="page-request-server-fn-meta">
              {typeof routeContext.pageRequestServerFnMeta === 'string'
                ? routeContext.pageRequestServerFnMeta
                : JSON.stringify(routeContext.pageRequestServerFnMeta)}
            </span>
          </div>
        </div>
        <br />
        <div data-testid="loader-data">
          <h3>Loader Data (SSR)</h3>
          <h4>Server Captured Metadata:</h4>
          <div>
            Function ID:{' '}
            <span data-testid="loader-function-id">
              {loaderData.serverMeta?.id}
            </span>
          </div>
          <div>
            Function Name:{' '}
            <span data-testid="loader-function-name">
              {loaderData.serverMeta?.name}
            </span>
          </div>
          <div>
            Filename:{' '}
            <span data-testid="loader-filename">
              {loaderData.serverMeta?.filename}
            </span>
          </div>
          <h4>Client Captured Metadata (via sendContext):</h4>
          <p>Client middleware only receives id, not name or filename:</p>
          <div>
            Client Captured ID:{' '}
            <span data-testid="loader-client-captured-id">
              {loaderData.clientCapturedMeta?.id}
            </span>
          </div>
          <div>
            Client Captured Name:{' '}
            <span data-testid="loader-client-captured-name">
              {/* Cast to any to test that name is not present at runtime */}
              {(loaderData.clientCapturedMeta as any)?.name ?? 'undefined'}
            </span>
          </div>
          <div>
            Client Captured Filename:{' '}
            <span data-testid="loader-client-captured-filename">
              {/* Cast to any to test that filename is not present at runtime */}
              {(loaderData.clientCapturedMeta as any)?.filename ?? 'undefined'}
            </span>
          </div>
          <h4>Request Middleware Captured Metadata:</h4>
          <p>
            Request middleware receives full ServerFnMeta for server function
            calls:
          </p>
          <div>
            Request Captured ID:{' '}
            <span data-testid="loader-request-captured-id">
              {loaderData.requestCapturedMeta?.id ?? 'undefined'}
            </span>
          </div>
          <div>
            Request Captured Name:{' '}
            <span data-testid="loader-request-captured-name">
              {loaderData.requestCapturedMeta?.name ?? 'undefined'}
            </span>
          </div>
          <div>
            Request Captured Filename:{' '}
            <span data-testid="loader-request-captured-filename">
              {loaderData.requestCapturedMeta?.filename ?? 'undefined'}
            </span>
          </div>
        </div>
        <br />
        <div>
          <button
            data-testid="call-server-fn-btn"
            onClick={async () => {
              const data = await getMetadataFn()
              setClientData(data)
            }}
          >
            Call server function from client
          </button>
        </div>
        <br />
        {clientData && (
          <div data-testid="client-data">
            <h3>Client Data</h3>
            <h4>Server Captured Metadata:</h4>
            <div>
              Function ID:{' '}
              <span data-testid="client-function-id">
                {clientData.serverMeta?.id}
              </span>
            </div>
            <div>
              Function Name:{' '}
              <span data-testid="client-function-name">
                {clientData.serverMeta?.name}
              </span>
            </div>
            <div>
              Filename:{' '}
              <span data-testid="client-filename">
                {clientData.serverMeta?.filename}
              </span>
            </div>
            <h4>Client Captured Metadata (via sendContext):</h4>
            <p>Client middleware only receives id, not name or filename:</p>
            <div>
              Client Captured ID:{' '}
              <span data-testid="client-client-captured-id">
                {clientData.clientCapturedMeta?.id}
              </span>
            </div>
            <div>
              Client Captured Name:{' '}
              <span data-testid="client-client-captured-name">
                {/* Cast to any to test that name is not present at runtime */}
                {(clientData.clientCapturedMeta as any)?.name ?? 'undefined'}
              </span>
            </div>
            <div>
              Client Captured Filename:{' '}
              <span data-testid="client-client-captured-filename">
                {/* Cast to any to test that filename is not present at runtime */}
                {(clientData.clientCapturedMeta as any)?.filename ??
                  'undefined'}
              </span>
            </div>
            <h4>Request Middleware Captured Metadata:</h4>
            <p>
              Request middleware receives full ServerFnMeta for server function
              calls:
            </p>
            <div>
              Request Captured ID:{' '}
              <span data-testid="client-request-captured-id">
                {clientData.requestCapturedMeta?.id ?? 'undefined'}
              </span>
            </div>
            <div>
              Request Captured Name:{' '}
              <span data-testid="client-request-captured-name">
                {clientData.requestCapturedMeta?.name ?? 'undefined'}
              </span>
            </div>
            <div>
              Request Captured Filename:{' '}
              <span data-testid="client-request-captured-filename">
                {clientData.requestCapturedMeta?.filename ?? 'undefined'}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
