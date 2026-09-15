import { createFileRoute, useHydrated } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  createFromFetch,
  createFromReadableStream,
  renderToReadableStream,
} from '@tanstack/react-start/rsc'
import { Suspense, use, useState } from 'react'
import { formatTime, pageStyles, serverStyles } from '~/utils/styles'

// ============================================================================
// Pattern 1: Server function returning raw Response with Flight stream
// This runs in RSC context where renderToReadableStream is available
// ============================================================================
const getRscFlightResponse = createServerFn({ method: 'GET' }).handler(
  async () => {
    const stream = renderToReadableStream(
      <div style={serverStyles.container} data-testid="flight-response-content">
        <div style={serverStyles.header}>
          <span style={serverStyles.badge}>SERVER FN RESPONSE</span>
          <span style={serverStyles.timestamp}>{formatTime(Date.now())}</span>
        </div>
        <p style={serverStyles.text}>
          This content was rendered via server function returning Response
        </p>
      </div>,
    )

    return new Response(stream, {
      headers: { 'Content-Type': 'text/x-component' },
    })
  },
)

// ============================================================================
// Route Definition
// ============================================================================
export const Route = createFileRoute('/rsc-flight-api')({
  component: RscFlightApiComponent,
})

function RscFlightApiComponent() {
  const isHydrated = useHydrated()

  // Pattern 1: Server function returning Response
  const [responsePromise, setResponsePromise] =
    useState<Promise<React.ReactNode> | null>(null)
  const [responseError, setResponseError] = useState<string | null>(null)

  // Pattern 2: API route returning Flight stream
  const [apiPromise, setApiPromise] = useState<Promise<React.ReactNode> | null>(
    null,
  )
  const [apiError, setApiError] = useState<string | null>(null)

  // Pattern 1: Fetch from server function
  const handleResponseClick = async () => {
    setResponseError(null)
    try {
      const response = await getRscFlightResponse()

      if (!(response instanceof Response)) {
        throw new Error(
          `Expected Response but got ${typeof response}: ${JSON.stringify(response)}`,
        )
      }

      const tree = await createFromFetch(Promise.resolve(response))
      setResponsePromise(Promise.resolve(tree as React.ReactNode))
    } catch (e: any) {
      setResponseError(e?.message || String(e))
    }
  }

  // Pattern 2: Fetch from API route
  const handleApiClick = async () => {
    setApiError(null)
    try {
      const response = await fetch('/api/rsc-flight')

      if (!response.ok) {
        throw new Error(
          `API returned ${response.status}: ${response.statusText}`,
        )
      }

      if (!response.body) {
        throw new Error('Response has no body')
      }

      const tree = await createFromReadableStream(response.body)
      setApiPromise(Promise.resolve(tree as React.ReactNode))
    } catch (e: any) {
      setApiError(e?.message || String(e))
    }
  }

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-flight-api-title" style={pageStyles.title}>
        Low-Level Flight Stream API
      </h1>
      <p style={pageStyles.description}>
        This page demonstrates low-level access to RSC Flight stream generation
        and rendering using two patterns: server function returning Response and
        API route returning Flight stream.
      </p>

      {/* Pattern 1: Server Function Response */}
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          marginBottom: '16px',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: '16px', color: '#334155' }}>
          Pattern 1: Server Function + createFromFetch
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#64748b' }}>
          Server function returns a raw Response wrapping the Flight stream.
          Client uses <code>createFromFetch</code> to decode.
        </p>
        <button
          data-testid="fetch-response-button"
          onClick={handleResponseClick}
          disabled={!isHydrated}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0284c7',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Fetch Flight Response
        </button>
        <div data-testid="flight-response-result" style={{ marginTop: '12px' }}>
          {responseError ? (
            <div
              data-testid="flight-response-error"
              style={{ color: 'red', fontWeight: 'bold' }}
            >
              Error: {responseError}
            </div>
          ) : responsePromise ? (
            <Suspense fallback={<div data-testid="loading">Loading...</div>}>
              <FlightRenderer promise={responsePromise} />
            </Suspense>
          ) : (
            <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
              Click button to fetch
            </div>
          )}
        </div>
      </div>

      {/* Pattern 2: API Route */}
      <div
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: '16px', color: '#334155' }}>
          Pattern 2: API Route + createFromReadableStream
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#64748b' }}>
          API route calls a server function that returns a ReadableStream, wraps
          it in a Response. Client fetches and uses{' '}
          <code>createFromReadableStream</code> to decode.
        </p>
        <button
          data-testid="fetch-api-button"
          onClick={handleApiClick}
          disabled={!isHydrated}
          style={{
            padding: '8px 16px',
            backgroundColor: '#0284c7',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          Fetch from API Route
        </button>
        <div data-testid="api-result" style={{ marginTop: '12px' }}>
          {apiError ? (
            <div
              data-testid="api-error"
              style={{ color: 'red', fontWeight: 'bold' }}
            >
              Error: {apiError}
            </div>
          ) : apiPromise ? (
            <Suspense
              fallback={<div data-testid="api-loading">Loading...</div>}
            >
              <FlightRenderer promise={apiPromise} />
            </Suspense>
          ) : (
            <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
              Click button to fetch
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FlightRenderer({ promise }: { promise: Promise<React.ReactNode> }) {
  const tree = use(promise)
  return <>{tree}</>
}
