import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
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

// Simulate slow data fetching
async function fetchDeferredAnalytics(): Promise<{
  visitors: number
  pageViews: number
  bounceRate: number
  avgSessionDuration: string
  topPages: Array<{ path: string; views: number }>
}> {
  // Simulate slow API call
  await new Promise((resolve) => setTimeout(resolve, 2000))
  return {
    visitors: Math.floor(Math.random() * 50000) + 10000,
    pageViews: Math.floor(Math.random() * 200000) + 50000,
    bounceRate: Math.floor(Math.random() * 30) + 20,
    avgSessionDuration: `${Math.floor(Math.random() * 5) + 2}m ${Math.floor(Math.random() * 60)}s`,
    topPages: [
      { path: '/home', views: Math.floor(Math.random() * 10000) + 5000 },
      { path: '/products', views: Math.floor(Math.random() * 8000) + 3000 },
      { path: '/about', views: Math.floor(Math.random() * 5000) + 1000 },
      { path: '/contact', views: Math.floor(Math.random() * 3000) + 500 },
    ],
  }
}

const getDeferredDataBundle = createServerFn({ method: 'GET' })
  .validator((data: { reportType: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()
    const instanceId = Math.random().toString(36).slice(2, 8)

    // Create RSC - must await since renderServerComponent is async
    const ReportHeader = await renderServerComponent(
      <div style={serverBox} data-testid="rsc-deferred-header">
        <div style={serverHeader}>
          <span style={serverBadge}>INSTANT RSC</span>
          <span style={timestamp} data-testid="rsc-deferred-timestamp">
            {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>

        <h2
          style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}
          data-testid="rsc-deferred-title"
        >
          Analytics Report: {data.reportType}
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
          This header rendered immediately. The analytics data below is
          streaming via a deferred Promise and rendered on the client.
        </p>
        <div
          style={{
            marginTop: '12px',
            fontSize: '11px',
            color: '#94a3b8',
            fontFamily: 'monospace',
          }}
          data-testid="rsc-deferred-instance"
        >
          Instance: {instanceId}
        </div>
      </div>,
    )

    // Return RSC immediately, plus a deferred Promise for slow data
    return {
      instanceId,
      timestamp: serverTimestamp,
      ReportHeader,
      // This Promise is deferred - it will stream when ready
      deferredAnalytics: fetchDeferredAnalytics(),
    }
  })

export const Route = createFileRoute('/rsc-deferred')({
  loader: async () => {
    // Returns RSC immediately + deferred Promise that streams
    const bundle = await getDeferredDataBundle({
      data: { reportType: 'Weekly Analytics' },
    })
    return {
      ...bundle,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscDeferredComponent,
})

// Analytics data type from server
type AnalyticsData = {
  visitors: number
  pageViews: number
  bounceRate: number
  avgSessionDuration: string
  topPages: Array<{ path: string; views: number }>
}

// Client component that renders the deferred analytics data
function AnalyticsDisplay({ data }: { data: AnalyticsData }) {
  const [selectedMetric, setSelectedMetric] = React.useState<string | null>(
    null,
  )

  return (
    <div style={clientStyles.container} data-testid="analytics-display">
      <div style={clientStyles.header}>
        <span style={clientStyles.badge}>
          CLIENT RENDERED (FROM STREAMED DATA)
        </span>
      </div>

      <h3 style={{ margin: '0 0 16px 0', color: '#166534' }}>
        Analytics Dashboard
      </h3>

      {/* Metrics Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div
          data-testid="metric-visitors"
          onClick={() => setSelectedMetric('visitors')}
          style={{
            padding: '16px',
            backgroundColor:
              selectedMetric === 'visitors' ? '#bbf7d0' : '#f0fdf4',
            borderRadius: '8px',
            cursor: 'pointer',
            border:
              selectedMetric === 'visitors'
                ? '2px solid #16a34a'
                : '1px solid #bbf7d0',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>Visitors</div>
          <div
            style={{ fontSize: '24px', fontWeight: 'bold', color: '#166534' }}
          >
            {data.visitors.toLocaleString()}
          </div>
        </div>

        <div
          data-testid="metric-pageviews"
          onClick={() => setSelectedMetric('pageviews')}
          style={{
            padding: '16px',
            backgroundColor:
              selectedMetric === 'pageviews' ? '#bbf7d0' : '#f0fdf4',
            borderRadius: '8px',
            cursor: 'pointer',
            border:
              selectedMetric === 'pageviews'
                ? '2px solid #16a34a'
                : '1px solid #bbf7d0',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>Page Views</div>
          <div
            style={{ fontSize: '24px', fontWeight: 'bold', color: '#166534' }}
          >
            {data.pageViews.toLocaleString()}
          </div>
        </div>

        <div
          data-testid="metric-bouncerate"
          onClick={() => setSelectedMetric('bouncerate')}
          style={{
            padding: '16px',
            backgroundColor:
              selectedMetric === 'bouncerate' ? '#bbf7d0' : '#f0fdf4',
            borderRadius: '8px',
            cursor: 'pointer',
            border:
              selectedMetric === 'bouncerate'
                ? '2px solid #16a34a'
                : '1px solid #bbf7d0',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>Bounce Rate</div>
          <div
            style={{ fontSize: '24px', fontWeight: 'bold', color: '#166534' }}
          >
            {data.bounceRate}%
          </div>
        </div>

        <div
          data-testid="metric-duration"
          onClick={() => setSelectedMetric('duration')}
          style={{
            padding: '16px',
            backgroundColor:
              selectedMetric === 'duration' ? '#bbf7d0' : '#f0fdf4',
            borderRadius: '8px',
            cursor: 'pointer',
            border:
              selectedMetric === 'duration'
                ? '2px solid #16a34a'
                : '1px solid #bbf7d0',
          }}
        >
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Avg. Session Duration
          </div>
          <div
            style={{ fontSize: '24px', fontWeight: 'bold', color: '#166534' }}
          >
            {data.avgSessionDuration}
          </div>
        </div>
      </div>

      {/* Top Pages */}
      <div
        style={{
          padding: '12px',
          backgroundColor: '#f0fdf4',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            fontSize: '12px',
            color: '#166534',
            fontWeight: 'bold',
            marginBottom: '8px',
          }}
        >
          TOP PAGES
        </div>
        {data.topPages.map((page, i) => (
          <div
            key={page.path}
            data-testid={`top-page-${i}`}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom:
                i < data.topPages.length - 1 ? '1px solid #bbf7d0' : 'none',
            }}
          >
            <span style={{ color: '#334155' }}>{page.path}</span>
            <span style={{ fontWeight: 'bold', color: '#166534' }}>
              {page.views.toLocaleString()} views
            </span>
          </div>
        ))}
      </div>

      {selectedMetric && (
        <div
          data-testid="selected-metric"
          style={{
            marginTop: '12px',
            padding: '8px 12px',
            backgroundColor: '#dcfce7',
            borderRadius: '4px',
            fontSize: '13px',
            color: '#166534',
          }}
        >
          Selected: <strong>{selectedMetric}</strong>
        </div>
      )}
    </div>
  )
}

// Loading fallback for deferred data
function AnalyticsLoading() {
  return (
    <div style={asyncStyles.container} data-testid="analytics-loading">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '12px',
        }}
      >
        <span style={asyncStyles.badge}>LOADING DEFERRED DATA</span>
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

      <p style={{ margin: 0, color: '#92400e', fontSize: '14px' }}>
        The analytics data is being streamed from the server... This simulates a
        slow API call (2 seconds).
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

function RscDeferredComponent() {
  const {
    ReportHeader,
    deferredAnalytics,
    instanceId,
    timestamp,
    loaderTimestamp,
  } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-deferred-page-title" style={pageStyles.title}>
        Deferred Data - RSC with Streamed Promise
      </h1>
      <p style={pageStyles.description}>
        This example demonstrates returning an RSC alongside a deferred Promise.
        The RSC header renders immediately, while the analytics data streams
        separately and is rendered on the client with Suspense. This pattern
        allows showing UI immediately while slow data loads progressively.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        <span data-testid="instance-id" style={{ display: 'none' }}>
          {instanceId}
        </span>
        <span data-testid="server-timestamp" style={{ display: 'none' }}>
          {timestamp}
        </span>
        Instance ID: {instanceId} | Server timestamp: {formatTime(timestamp)}
      </div>

      {/* RSC renders immediately */}
      {ReportHeader}

      {/* Deferred data rendered client-side with Suspense */}
      <div style={{ marginTop: '16px' }}>
        <React.Suspense fallback={<AnalyticsLoading />}>
          <DeferredAnalyticsWrapper promise={deferredAnalytics} />
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
          <li>
            The server function returns both an RSC (ReportHeader) and a Promise
            (deferredAnalytics)
          </li>
          <li>
            The RSC renders immediately on the server and streams to the client
          </li>
          <li>
            The Promise is deferred - it starts executing on the server but
            streams its result when ready
          </li>
          <li>
            The client uses React Suspense to show a loading state while waiting
            for the deferred data
          </li>
          <li>
            Once the data arrives, it's rendered by a client component with full
            interactivity
          </li>
          <li>
            This pattern is ideal when you have fast static content and slow
            dynamic data
          </li>
        </ul>
      </div>
    </div>
  )
}

// Wrapper component that handles the Promise
function DeferredAnalyticsWrapper({
  promise,
}: {
  promise: Promise<AnalyticsData>
}) {
  const data = React.use(promise)
  return <AnalyticsDisplay data={data} />
}
