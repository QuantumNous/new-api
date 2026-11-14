import * as React from 'react'
import { createFileRoute, useHydrated } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  renderServerComponent,
  createCompositeComponent,
  CompositeComponent,
  AnyCompositeComponent,
} from '@tanstack/react-start/rsc'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import {
  pageStyles,
  clientStyles,
  asyncStyles,
  formatTime,
} from '~/utils/styles'

// ============================================================================
// Server Component Definition
// ============================================================================

// Helper to add artificial delay for demonstrating streaming
async function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const getAsyncRscBundle = createServerFn({ method: 'GET' })
  .validator((data: { scenario: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()
    const bundleId = Math.random().toString(36).slice(2, 8)

    // Return Promises directly - NOT awaited
    // Each RSC will load independently and stream to the client
    return {
      bundleId,
      timestamp: serverTimestamp,
      // Fast RSC - loads in 100ms (no slots, use renderServerComponent)
      FastComponent: (async () => {
        await simulateDelay(100)
        return renderServerComponent(
          <div style={serverBox} data-testid="rsc-async-fast">
            <div style={serverHeader}>
              <span style={serverBadge}>FAST RSC (100ms)</span>
              <span style={timestamp} data-testid="rsc-async-fast-timestamp">
                {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>
            <div style={{ padding: '16px', textAlign: 'center' }}>
              <div
                style={{ fontSize: '32px', marginBottom: '8px' }}
                data-testid="rsc-async-fast-icon"
              >
                ⚡
              </div>
              <h3
                style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}
                data-testid="rsc-async-fast-title"
              >
                Fast Loading Component
              </h3>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                This RSC loaded quickly (100ms delay).
              </p>
              <div
                style={{
                  marginTop: '12px',
                  fontSize: '11px',
                  color: '#94a3b8',
                  fontFamily: 'monospace',
                }}
                data-testid="rsc-async-fast-bundle"
              >
                Bundle: {bundleId} | Scenario: {data.scenario}
              </div>
            </div>
          </div>,
        )
      })(),
      // Medium RSC - loads in 500ms (has children slot, use createCompositeComponent)
      MediumComponent: (async () => {
        await simulateDelay(500)
        return createCompositeComponent(
          (props: { children?: React.ReactNode }) => {
            return (
              <div style={serverBox} data-testid="rsc-async-medium">
                <div style={serverHeader}>
                  <span style={serverBadge}>MEDIUM RSC (500ms)</span>
                  <span
                    style={timestamp}
                    data-testid="rsc-async-medium-timestamp"
                  >
                    {new Date(serverTimestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <div
                    style={{ fontSize: '32px', marginBottom: '8px' }}
                    data-testid="rsc-async-medium-icon"
                  >
                    ⏳
                  </div>
                  <h3
                    style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}
                    data-testid="rsc-async-medium-title"
                  >
                    Medium Loading Component
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                    This RSC took a bit longer (500ms delay).
                  </p>
                  {props.children && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '8px',
                        backgroundColor: '#f0fdf4',
                        borderRadius: '4px',
                        border: '1px solid #bbf7d0',
                      }}
                      data-testid="rsc-async-medium-slot"
                    >
                      {props.children}
                    </div>
                  )}
                </div>
              </div>
            )
          },
        )
      })(),
      // Slow RSC - loads in 1500ms (has renderStatus slot, use createCompositeComponent)
      SlowComponent: (async () => {
        await simulateDelay(1500)
        return createCompositeComponent(
          (props: { renderStatus?: () => React.ReactNode }) => {
            return (
              <div style={serverBox} data-testid="rsc-async-slow">
                <div style={serverHeader}>
                  <span style={serverBadge}>SLOW RSC (1500ms)</span>
                  <span
                    style={timestamp}
                    data-testid="rsc-async-slow-timestamp"
                  >
                    {new Date(serverTimestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div style={{ padding: '16px', textAlign: 'center' }}>
                  <div
                    style={{ fontSize: '32px', marginBottom: '8px' }}
                    data-testid="rsc-async-slow-icon"
                  >
                    🐢
                  </div>
                  <h3
                    style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}
                    data-testid="rsc-async-slow-title"
                  >
                    Slow Loading Component
                  </h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                    This RSC took the longest (1500ms delay).
                  </p>
                  {props.renderStatus && (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '8px',
                        backgroundColor: '#fef3c7',
                        borderRadius: '4px',
                        border: '1px solid #fde68a',
                      }}
                      data-testid="rsc-async-slow-status"
                    >
                      {props.renderStatus()}
                    </div>
                  )}
                </div>
              </div>
            )
          },
        )
      })(),
    }
  })

export const Route = createFileRoute('/rsc-async-bundle')({
  loader: async () => {
    // Server function returns Promises for each RSC - NOT awaited
    // This allows streaming/progressive loading on the client
    const bundle = await getAsyncRscBundle({
      data: { scenario: 'Progressive Loading Demo' },
    })
    return {
      ...bundle,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscAsyncBundleComponent,
})

// Loading fallback component
function LoadingFallback({ name, delay }: { name: string; delay: string }) {
  return (
    <div style={asyncStyles.container} data-testid={`loading-${name}`}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <span style={asyncStyles.badge}>LOADING {name.toUpperCase()}</span>
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
      <p style={{ margin: '8px 0 0 0', color: '#92400e', fontSize: '14px' }}>
        Waiting for {name} component... ({delay} delay)
      </p>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Wrapper component that uses React.use() to resolve the Promise for renderServerComponent results
function AsyncRscWrapper({
  promise,
  testId,
}: {
  promise: Promise<React.ReactNode>
  testId: string
}) {
  const resolved = React.use(promise)
  return <div data-testid={testId}>{resolved}</div>
}

// Wrapper component for CompositeComponent that uses React.use() to resolve the Promise
function AsyncCompositeWrapper<TComp extends AnyCompositeComponent>({
  promise,
  props,
  testId,
}: {
  promise: Promise<TComp>
  props: TComp['~types']['props']
  testId: string
}) {
  const CompositeComponentValue = React.use(promise)
  return (
    <div data-testid={testId}>
      <CompositeComponent src={CompositeComponentValue} {...(props as {})} />
    </div>
  )
}

function RscAsyncBundleComponent() {
  const {
    FastComponent,
    MediumComponent,
    SlowComponent,
    bundleId,
    timestamp,
    loaderTimestamp,
  } = Route.useLoaderData()

  const [interactionCount, setInteractionCount] = React.useState(0)
  const hydrated = useHydrated()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-async-bundle-page-title" style={pageStyles.title}>
        Async RSC Bundle - Progressive Loading with React.use()
      </h1>
      <p style={pageStyles.description}>
        This example demonstrates returning multiple RSC Promises from a single
        server function <strong>without awaiting them</strong>. Each RSC loads
        independently and streams to the client. The client uses{' '}
        <code>React.use()</code> inside <code>Suspense</code> boundaries to
        progressively render each component as it becomes available.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        <span data-testid="bundle-id" style={{ display: 'none' }}>
          {bundleId}
        </span>
        <span data-testid="bundle-timestamp" style={{ display: 'none' }}>
          {timestamp}
        </span>
        Bundle ID: {bundleId} | Server timestamp: {formatTime(timestamp)}
      </div>

      {/* Three RSCs with different loading times, each in its own Suspense */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        {/* Fast RSC - 100ms (no slots, renders directly) */}
        <React.Suspense
          fallback={<LoadingFallback name="fast" delay="100ms" />}
        >
          <AsyncRscWrapper
            promise={FastComponent}
            testId="async-fast-wrapper"
          />
        </React.Suspense>

        {/* Medium RSC - 500ms with children slot */}
        <React.Suspense
          fallback={<LoadingFallback name="medium" delay="500ms" />}
        >
          <AsyncCompositeWrapper
            promise={MediumComponent}
            props={{
              children: (
                <div style={clientStyles.container}>
                  <span style={clientStyles.badge}>CLIENT SLOT</span>
                  <button
                    data-testid="medium-slot-btn"
                    disabled={!hydrated}
                    onClick={() => setInteractionCount((c) => c + 1)}
                    style={{
                      ...clientStyles.button,
                      ...clientStyles.primaryButton,
                      marginTop: '8px',
                    }}
                  >
                    Interact ({interactionCount})
                  </button>
                </div>
              ),
            }}
            testId="async-medium-wrapper"
          />
        </React.Suspense>

        {/* Slow RSC - 1500ms with render prop */}
        <React.Suspense
          fallback={<LoadingFallback name="slow" delay="1500ms" />}
        >
          <AsyncCompositeWrapper
            promise={SlowComponent}
            props={{
              renderStatus: () => (
                <div data-testid="slow-status-content">
                  <span style={{ fontWeight: 'bold', color: '#92400e' }}>
                    Status: Loaded!
                  </span>
                  <span
                    style={{
                      marginLeft: '8px',
                      fontSize: '12px',
                      color: '#b45309',
                    }}
                  >
                    Interactions: {interactionCount}
                  </span>
                </div>
              ),
            }}
            testId="async-slow-wrapper"
          />
        </React.Suspense>
      </div>

      {/* Interaction counter */}
      <div
        style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
      >
        <span style={{ color: '#166534', fontWeight: 'bold' }}>
          Total Interactions:
        </span>
        <span
          data-testid="interaction-count"
          style={{ fontSize: '20px', fontWeight: 'bold', color: '#16a34a' }}
        >
          {interactionCount}
        </span>
        <button
          data-testid="increment-btn"
          disabled={!hydrated}
          onClick={() => setInteractionCount((c) => c + 1)}
          style={{
            ...clientStyles.button,
            ...clientStyles.primaryButton,
            marginLeft: 'auto',
          }}
        >
          Increment
        </button>
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
          <li>
            The server function returns RSC Promises directly - they are{' '}
            <strong>not awaited</strong> on the server
          </li>
          <li>
            Each RSC is wrapped in its own <code>Suspense</code> boundary with a
            loading fallback
          </li>
          <li>
            The client uses <code>React.use()</code> to consume each Promise and
            render when ready
          </li>
          <li>
            RSCs load progressively: Fast (100ms) → Medium (500ms) → Slow
            (1500ms)
          </li>
          <li>
            Client slots and render props work normally once each RSC resolves
          </li>
          <li>
            This pattern is ideal when you have independent data sources with
            varying latencies
          </li>
        </ul>
      </div>
    </div>
  )
}
