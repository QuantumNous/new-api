import { Suspense } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { pageStyles, asyncStyles, formatTime } from '~/utils/styles'

// ============================================================================
// Server Component Definitions
// ============================================================================

async function fetchSlowData(
  label: string,
  delay: number,
): Promise<{ label: string; value: number; trend: string }> {
  await new Promise((resolve) => setTimeout(resolve, delay))
  return {
    label,
    value: Math.floor(Math.random() * 10000),
    trend: Math.random() > 0.5 ? '+12.5%' : '-3.2%',
  }
}

function MetricLoading({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#fef3c7',
        borderRadius: '8px',
        border: '1px solid #f59e0b',
      }}
      data-testid="async-loading"
    >
      <div style={{ fontSize: '12px', color: '#92400e', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#92400e' }}>
        Loading...
      </div>
      <div style={{ fontSize: '11px', color: '#92400e', marginTop: '8px' }}>
        Streaming from server...
      </div>
    </div>
  )
}

async function AsyncMetric({ label, delay }: { label: string; delay: number }) {
  const data = await fetchSlowData(label, delay)
  const isPositive = data.trend.startsWith('+')

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: '#f0f9ff',
        borderRadius: '8px',
        border: '1px solid #bae6fd',
      }}
      data-testid="async-content"
    >
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
        {data.label}
      </div>
      <div
        style={{ fontSize: '28px', fontWeight: 'bold', color: '#0c4a6e' }}
        data-testid="async-data"
      >
        {data.value.toLocaleString()}
      </div>
      <div
        style={{
          fontSize: '13px',
          color: isPositive ? '#16a34a' : '#dc2626',
          marginTop: '4px',
        }}
      >
        {data.trend} from last period
      </div>
      <div
        style={{ fontSize: '11px', color: '#94a3b8', marginTop: '8px' }}
        data-testid="async-delay"
      >
        Loaded after {delay}ms
      </div>
    </div>
  )
}

const getSuspenseServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { delay?: number }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()
    const delay = data.delay ?? 100

    return renderServerComponent(
      <div style={serverBox} data-testid="rsc-suspense-content">
        <div style={serverHeader}>
          <span style={serverBadge}>ASYNC METRIC</span>
          <span style={timestamp} data-testid="rsc-suspense-timestamp">
            Started: {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>
        <Suspense fallback={<MetricLoading label="Page Views" />}>
          <AsyncMetric label="Page Views" delay={delay} />
        </Suspense>
      </div>,
    )
  })

const getMultiSuspenseServerComponent = createServerFn({
  method: 'GET',
}).handler(async () => {
  const serverTimestamp = Date.now()

  return renderServerComponent(
    <div style={serverBox} data-testid="rsc-multi-suspense-content">
      <div style={serverHeader}>
        <span style={serverBadge}>ANALYTICS DASHBOARD</span>
        <span style={timestamp} data-testid="rsc-multi-suspense-timestamp">
          Started: {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>
      <p style={{ margin: '0 0 16px 0', color: '#64748b', fontSize: '14px' }}>
        Watch the metrics load progressively. Each card fetches data
        independently.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
        }}
      >
        <div data-testid="section-fast">
          <Suspense fallback={<MetricLoading label="Active Users (Fast)" />}>
            <AsyncMetric label="Active Users (Fast)" delay={500} />
          </Suspense>
        </div>
        <div data-testid="section-medium">
          <Suspense fallback={<MetricLoading label="Revenue (Medium)" />}>
            <AsyncMetric label="Revenue (Medium)" delay={1500} />
          </Suspense>
        </div>
        <div data-testid="section-slow">
          <Suspense fallback={<MetricLoading label="Conversion Rate (Slow)" />}>
            <AsyncMetric label="Conversion Rate (Slow)" delay={2500} />
          </Suspense>
        </div>
        <div data-testid="section-slowest">
          <Suspense
            fallback={<MetricLoading label="Customer Lifetime (Slowest)" />}
          >
            <AsyncMetric label="Customer Lifetime (Slowest)" delay={3500} />
          </Suspense>
        </div>
      </div>
    </div>,
  )
})

export const Route = createFileRoute('/rsc-suspense')({
  loader: async () => {
    // Load RSC with longer delays for better visualization
    const [SuspenseServer, MultiSuspenseServer] = await Promise.all([
      getSuspenseServerComponent({ data: { delay: 2000 } }),
      getMultiSuspenseServerComponent(),
    ])
    return {
      SuspenseServer,
      MultiSuspenseServer,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscSuspenseComponent,
})

function LoadingCard({ label }: { label: string }) {
  return (
    <div style={asyncStyles.container}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <span style={asyncStyles.badge}>LOADING</span>
        <span style={{ fontSize: '13px', color: '#92400e' }}>{label}</span>
      </div>
      <div
        style={{
          height: '60px',
          backgroundColor: '#fde68a',
          borderRadius: '6px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      </div>
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#92400e' }}>
        Streaming from server...
      </div>
    </div>
  )
}

function RscSuspenseComponent() {
  const { SuspenseServer, MultiSuspenseServer, loaderTimestamp } =
    Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-suspense-title" style={pageStyles.title}>
        Analytics Dashboard - Async Loading
      </h1>
      <p style={pageStyles.description}>
        This demonstrates RSC with async data fetching. Each metric card has a
        different delay (0.5s to 3.5s) to show how RSC streams content
        progressively. Watch the amber loading states transform into blue
        completed states!
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Legend for loading states */}
      <div style={{ ...pageStyles.legend, marginBottom: '24px' }}>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor('#f59e0b')} />
          <span style={pageStyles.legendText}>Loading (streaming)</span>
        </div>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor('#0284c7')} />
          <span style={pageStyles.legendText}>Loaded (server data)</span>
        </div>
      </div>

      <section
        data-testid="single-suspense-section"
        style={{ marginBottom: '24px' }}
      >
        <h2
          style={{ fontSize: '16px', color: '#334155', marginBottom: '12px' }}
        >
          Single Async Metric (2 second delay)
        </h2>
        <Suspense
          fallback={<LoadingCard label="Page Views metric loading..." />}
        >
          {SuspenseServer}
        </Suspense>
      </section>

      <section data-testid="multi-suspense-section">
        <h2
          style={{ fontSize: '16px', color: '#334155', marginBottom: '12px' }}
        >
          Dashboard Grid (Multiple delays: 0.5s, 1.5s, 2.5s, 3.5s)
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>
          Each card loads independently. Notice how they appear one by one as
          their data becomes available from the server.
        </p>
        <Suspense
          fallback={
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
              }}
            >
              <LoadingCard label="Active Users (Fast 0.5s)" />
              <LoadingCard label="Revenue (Medium 1.5s)" />
              <LoadingCard label="Conversion (Slow 2.5s)" />
              <LoadingCard label="Lifetime (Slowest 3.5s)" />
            </div>
          }
        >
          {MultiSuspenseServer}
        </Suspense>
      </section>

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
          <li>Async RSCs can fetch data on the server with different delays</li>
          <li>Suspense boundaries show loading states while streaming</li>
          <li>Content appears progressively as data becomes available</li>
          <li>
            The delays in this demo are intentionally long (0.5s-3.5s) for
            visibility
          </li>
        </ul>
      </div>
    </div>
  )
}
