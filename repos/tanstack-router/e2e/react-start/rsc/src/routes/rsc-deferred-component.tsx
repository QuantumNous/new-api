import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import {
  serverBadge,
  serverBox,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { asyncStyles, formatTime, pageStyles } from '~/utils/styles'

// ============================================================================
// Server function that returns an immediate RSC + a deferred Promise<RSC>
// Used to test that RSCs delivered via streaming Promise are decoded
// before the Promise resolves, preventing flash during render.
// ============================================================================

const getDeferredRscBundle = createServerFn({ method: 'GET' }).handler(
  async () => {
    const immediateId = `imm-${Math.random().toString(36).slice(2, 8)}`
    const deferredId = `def-${Math.random().toString(36).slice(2, 8)}`
    const immediateTimestamp = Date.now()

    // Immediate RSC - renders right away
    const ImmediateRsc = await renderServerComponent(
      <div style={serverBox} data-testid="deferred-immediate-rsc">
        <div style={serverHeader}>
          <span style={serverBadge}>IMMEDIATE RSC</span>
          <span style={timestamp} data-testid="deferred-immediate-timestamp">
            {new Date(immediateTimestamp).toLocaleTimeString()}
          </span>
        </div>
        <h3 style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}>
          Immediate Component
        </h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          This RSC was rendered immediately when the server function completed.
          It does not require streaming.
        </p>
        <div
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: '#94a3b8',
            fontFamily: 'monospace',
          }}
          data-testid="deferred-immediate-id"
        >
          {immediateId}
        </div>
      </div>,
    )

    // Deferred RSC - wrapped in Promise that resolves after 500ms
    // This tests that RSCs in streaming Promises are decoded before resolution
    const deferredRscPromise = new Promise<any>(async (resolve) => {
      await new Promise((r) => setTimeout(r, 500))
      const deferredTimestamp = Date.now()

      const DeferredRsc = await renderServerComponent(
        <div style={serverBox} data-testid="deferred-streamed-rsc">
          <div style={serverHeader}>
            <span style={serverBadge}>STREAMED RSC</span>
            <span style={timestamp} data-testid="deferred-streamed-timestamp">
              {new Date(deferredTimestamp).toLocaleTimeString()}
            </span>
          </div>
          <h3 style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}>
            Deferred Component (Streamed)
          </h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            This RSC was delivered via a streaming Promise that resolved after
            500ms. It should render without flash because the decode completes
            before the Promise resolves.
          </p>
          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              color: '#94a3b8',
              fontFamily: 'monospace',
            }}
            data-testid="deferred-streamed-id"
          >
            {deferredId}
          </div>
        </div>,
      )
      resolve(DeferredRsc)
    })

    return {
      ImmediateRsc,
      deferredRscPromise,
      immediateId,
      deferredId,
    }
  },
)

export const Route = createFileRoute('/rsc-deferred-component')({
  loader: async () => {
    const bundle = await getDeferredRscBundle()
    return {
      ...bundle,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscDeferredComponentPage,
})

function RscDeferredComponentPage() {
  const { ImmediateRsc, deferredRscPromise, loaderTimestamp } =
    Route.useLoaderData()

  return (
    <div
      style={pageStyles.container}
      data-testid="rsc-deferred-component-container"
    >
      <h1 data-testid="rsc-deferred-component-title" style={pageStyles.title}>
        Deferred RSC Component
      </h1>
      <p style={pageStyles.description}>
        This page tests RSC delivery via streaming Promise. The immediate RSC
        renders right away, while the deferred RSC arrives via a Promise that
        resolves after 500ms. The deferred RSC should render without flash
        because its decode completes before the Promise resolves.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Immediate RSC renders right away */}
      {ImmediateRsc}

      {/* Deferred RSC rendered via Suspense when Promise resolves */}
      <div style={{ marginTop: '16px' }}>
        <React.Suspense
          fallback={
            <div style={asyncStyles.container} data-testid="deferred-loading">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span style={asyncStyles.badge}>LOADING DEFERRED RSC</span>
                <div
                  style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid #fde68a',
                    borderTop: '2px solid #f59e0b',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }}
                />
              </div>
              <p
                style={{
                  margin: '8px 0 0 0',
                  color: '#92400e',
                  fontSize: '14px',
                }}
              >
                Waiting for deferred RSC to stream from server (500ms delay)...
              </p>
              <style>{`
                @keyframes spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
            </div>
          }
        >
          <DeferredRscWrapper promise={deferredRscPromise} />
        </React.Suspense>
      </div>

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
          <li>Immediate RSC renders right away</li>
          <li>
            Deferred RSC is wrapped in a Promise that resolves after 500ms
          </li>
          <li>
            The RSC decode is awaited before the Promise resolves (in the
            streaming chunk handler)
          </li>
          <li>
            No flash (display:none) should occur when the deferred RSC appears
          </li>
          <li>Client Suspense shows loading state while waiting</li>
        </ul>
      </div>
    </div>
  )
}

// Wrapper component that uses React.use() to unwrap the Promise
function DeferredRscWrapper({ promise }: { promise: Promise<any> }) {
  const DeferredRsc = React.use(promise)
  return <>{DeferredRsc}</>
}
