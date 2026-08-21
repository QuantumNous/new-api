import * as React from 'react'
import { createFileRoute, ErrorComponent } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { pageStyles, clientStyles, formatTime } from '~/utils/styles'

// ============================================================================
// Server Component Definition
// ============================================================================

const getErrorProneServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { shouldError: boolean; errorMessage?: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    if (data.shouldError) {
      throw new Error(
        data.errorMessage || 'Intentional server error for testing',
      )
    }

    return renderServerComponent(
      <div style={serverBox} data-testid="rsc-error-content">
        <div style={serverHeader}>
          <span style={serverBadge}>ERROR-PRONE RSC</span>
          <span style={timestamp} data-testid="rsc-error-timestamp">
            {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>

        <div
          style={{
            padding: '20px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
          <h3
            style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}
            data-testid="rsc-error-success"
          >
            Component Loaded Successfully
          </h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            This RSC did not throw an error. Toggle the error switch to see
            error handling in action.
          </p>
        </div>
      </div>,
    )
  })

type ErrorSearchParams = {
  shouldError?: boolean
}

export const Route = createFileRoute('/rsc-error')({
  validateSearch: (search: Record<string, unknown>): ErrorSearchParams => ({
    shouldError: search.shouldError === 'true' || search.shouldError === true,
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const ErrorProne = await getErrorProneServerComponent({
      data: {
        shouldError: deps.search.shouldError || false,
        errorMessage: 'RSC failed to load: Database connection timeout',
      },
    })
    return {
      ErrorProne,
      loaderTimestamp: Date.now(),
    }
  },
  errorComponent: RouteErrorComponent,
  component: RscErrorComponent,
})

function RouteErrorComponent({ error }: { error: Error }) {
  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-error-title" style={pageStyles.title}>
        Error Handling - RSC Error Boundary
      </h1>

      <div
        style={{
          padding: '24px',
          backgroundColor: '#fef2f2',
          border: '2px solid #dc2626',
          borderRadius: '8px',
          marginBottom: '16px',
        }}
        data-testid="error-boundary"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontSize: '32px' }}>💥</span>
          <div>
            <div
              style={{
                fontSize: '11px',
                color: '#dc2626',
                fontWeight: 'bold',
                letterSpacing: '0.5px',
              }}
            >
              ERROR CAUGHT
            </div>
            <h2
              style={{ margin: 0, color: '#991b1b' }}
              data-testid="error-message"
            >
              {error.message}
            </h2>
          </div>
        </div>

        <p style={{ color: '#64748b', marginBottom: '16px' }}>
          The RSC threw an error and the error boundary caught it. You can
          recover by navigating away or toggling the error switch off.
        </p>

        <a
          href="/rsc-error"
          data-testid="error-recover-link"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#dc2626',
            color: 'white',
            borderRadius: '6px',
            textDecoration: 'none',
            fontWeight: 'bold',
          }}
        >
          Recover (Reload Without Error)
        </a>
      </div>

      <div
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#64748b',
        }}
      >
        <strong>Key Points:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>RSC errors are caught by the route's errorComponent</li>
          <li>Users see a friendly error message, not a crash</li>
          <li>Recovery is possible by navigating or reloading</li>
        </ul>
      </div>
    </div>
  )
}

function RscErrorComponent() {
  const { ErrorProne, loaderTimestamp } = Route.useLoaderData()
  const { shouldError } = Route.useSearch()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-error-title" style={pageStyles.title}>
        Error Handling - RSC Error Boundary
      </h1>
      <p style={pageStyles.description}>
        This example tests error handling with RSC. Toggle the error switch to
        make the RSC throw an error. The error boundary catches it and displays
        a friendly message with recovery options.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Error Toggle */}
      <div style={clientStyles.container} data-testid="error-controls">
        <div style={clientStyles.header}>
          <span style={clientStyles.badge}>ERROR CONTROL</span>
        </div>

        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#166534' }}>
          Use the toggle to simulate an RSC error. When enabled, the next load
          will throw.
        </p>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <a
            href="/rsc-error?shouldError=true"
            data-testid="trigger-error-btn"
            style={{
              ...clientStyles.button,
              backgroundColor: '#dc2626',
              color: 'white',
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Trigger Error on Next Load
          </a>
          <span
            style={{ fontSize: '12px', color: '#64748b' }}
            data-testid="error-status"
          >
            Error mode: {shouldError ? 'ON' : 'OFF'}
          </span>
        </div>
      </div>

      {/* RSC Content */}
      {ErrorProne}

      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#64748b',
        }}
      >
        <strong>Key Points:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>RSC errors are caught by route error boundaries</li>
          <li>errorComponent provides a recovery UI</li>
          <li>Navigate away and back to recover from errors</li>
          <li>Error state can be controlled via search params</li>
        </ul>
      </div>
    </div>
  )
}
