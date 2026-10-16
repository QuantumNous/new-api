import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  createCompositeComponent,
  CompositeComponent,
} from '@tanstack/react-start/rsc'
import { clientStyles, formatTime, pageStyles } from '~/utils/styles'
import {
  serverBadge,
  serverBox,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'

// ============================================================================
// SSR: 'data-only' - Analytics Dashboard with Browser-based Visualization
// The loader runs on the server, but the component renders on the client.
// This is useful when you need server data but client-only APIs for rendering.
// ============================================================================

const getAnalyticsServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { reportPeriod: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Simulate fetching analytics from server database
    const analytics = {
      totalVisitors: 24583,
      pageViews: 89421,
      bounceRate: 34.2,
      avgSessionDuration: '4m 32s',
      topReferrers: [
        { source: 'Google', visits: 12450, percentage: 51 },
        { source: 'Twitter', visits: 5230, percentage: 21 },
        { source: 'Direct', visits: 4120, percentage: 17 },
        { source: 'LinkedIn', visits: 2783, percentage: 11 },
      ],
    }

    // Create RSC with slots for client-side visualization
    const AnalyticsDashboard = await createCompositeComponent(
      (props: {
        children?: React.ReactNode
        renderVisualization?: (data: {
          values: Array<{ label: string; value: number }>
        }) => React.ReactNode
      }) => {
        return (
          <div style={serverBox} data-testid="rsc-ssr-data-only-content">
            <div style={serverHeader}>
              <span style={serverBadge}>SERVER DATA</span>
              <span style={timestamp} data-testid="rsc-server-timestamp">
                Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>

            <h2
              style={{ margin: '0 0 8px 0', color: '#0c4a6e' }}
              data-testid="rsc-report-title"
            >
              Analytics Report: {data.reportPeriod}
            </h2>

            <p
              style={{
                margin: '0 0 16px 0',
                color: '#64748b',
                fontSize: '14px',
              }}
            >
              Data fetched on server, visualization rendered on client using
              browser APIs (window dimensions for responsive charts).
            </p>

            {/* Server-rendered metrics summary */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Total Visitors
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#0284c7',
                  }}
                  data-testid="metric-visitors"
                >
                  {analytics.totalVisitors.toLocaleString()}
                </div>
              </div>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                }}
              >
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Page Views
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#0284c7',
                  }}
                  data-testid="metric-pageviews"
                >
                  {analytics.pageViews.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Slot for client-side visualization */}
            <div
              style={{
                borderTop: '1px solid #bae6fd',
                paddingTop: '16px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: '#0369a1',
                  fontWeight: 'bold',
                  marginBottom: '8px',
                }}
              >
                REFERRER VISUALIZATION (Client Rendered)
              </div>
              {props.renderVisualization?.({
                values: analytics.topReferrers.map((r) => ({
                  label: r.source,
                  value: r.percentage,
                })),
              })}
            </div>

            {/* Slot for additional client content */}
            {props.children && (
              <div
                style={{ borderTop: '1px solid #bae6fd', paddingTop: '16px' }}
                data-testid="rsc-children-slot"
              >
                {props.children}
              </div>
            )}
          </div>
        )
      },
    )

    return {
      AnalyticsDashboard,
      analytics,
      serverTimestamp,
      reportPeriod: data.reportPeriod,
    }
  })

export const Route = createFileRoute('/rsc-ssr-data-only')({
  ssr: 'data-only',
  loader: async () => {
    const bundle = await getAnalyticsServerComponent({
      data: { reportPeriod: 'Last 7 Days' },
    })
    return {
      ...bundle,
      loaderTimestamp: Date.now(),
    }
  },
  pendingComponent: () => (
    <div style={pageStyles.container}>
      <div
        data-testid="pending-component"
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: '#fef3c7',
          border: '2px dashed #f59e0b',
          borderRadius: '8px',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>📊</div>
        <div style={{ color: '#92400e', fontWeight: 'bold' }}>
          Loading Analytics Dashboard...
        </div>
        <div style={{ color: '#b45309', fontSize: '13px', marginTop: '8px' }}>
          Server data loaded, rendering visualization...
        </div>
      </div>
    </div>
  ),
  component: RscSsrDataOnlyComponent,
})

function RscSsrDataOnlyComponent() {
  const { AnalyticsDashboard, analytics, serverTimestamp, loaderTimestamp } =
    Route.useLoaderData()

  // Browser-only state for responsive visualization
  const [windowWidth, setWindowWidth] = React.useState<number | null>(null)
  const [selectedReferrer, setSelectedReferrer] = React.useState<string | null>(
    null,
  )

  // Use browser API (window) - only available on client
  React.useEffect(() => {
    setWindowWidth(window.innerWidth)

    const handleResize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Calculate bar width based on window size
  const maxBarWidth = windowWidth ? Math.min(windowWidth - 100, 400) : 300

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-ssr-data-only-title" style={pageStyles.title}>
        Analytics Dashboard (SSR: data-only)
      </h1>
      <p style={pageStyles.description}>
        This example uses <code>ssr: 'data-only'</code> - the loader runs on the
        server to fetch both the React Server Component and its analytics data,
        but the route component renders on the client. This allows using browser
        APIs like <code>window.innerWidth</code> for responsive chart
        visualization while still benefiting from server-side data fetching.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        <span data-testid="server-timestamp-hidden" style={{ display: 'none' }}>
          {serverTimestamp}
        </span>
        Server data fetched at: {formatTime(serverTimestamp)}
      </div>

      <CompositeComponent
        src={AnalyticsDashboard}
        renderVisualization={({
          values,
        }: {
          values: Array<{ label: string; value: number }>
        }) => (
          <div style={clientStyles.container} data-testid="visualization">
            <div style={clientStyles.header}>
              <span style={clientStyles.badge}>CLIENT RENDERED</span>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Window: {windowWidth ?? 'measuring...'}px
              </span>
            </div>

            {/* Responsive bar chart using browser dimensions */}
            <div style={{ marginTop: '12px' }}>
              {values.map((item) => (
                <div
                  key={item.label}
                  data-testid={`bar-${item.label.toLowerCase()}`}
                  onClick={() => setSelectedReferrer(item.label)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    backgroundColor:
                      selectedReferrer === item.label
                        ? '#bbf7d0'
                        : 'transparent',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <div
                    style={{
                      width: '80px',
                      fontSize: '13px',
                      color: '#166534',
                      fontWeight:
                        selectedReferrer === item.label ? 'bold' : 'normal',
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      height: '24px',
                      width: `${(item.value / 100) * maxBarWidth}px`,
                      backgroundColor:
                        selectedReferrer === item.label ? '#16a34a' : '#86efac',
                      borderRadius: '4px',
                      transition: 'width 0.3s, background-color 0.2s',
                    }}
                  />
                  <div style={{ fontSize: '13px', color: '#166534' }}>
                    {item.value}%
                  </div>
                </div>
              ))}
            </div>

            {selectedReferrer && (
              <div
                data-testid="selected-referrer"
                style={{
                  marginTop: '12px',
                  padding: '8px 12px',
                  backgroundColor: '#dcfce7',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#166534',
                }}
              >
                Selected: <strong>{selectedReferrer}</strong> -{' '}
                {analytics.topReferrers
                  .find((r) => r.source === selectedReferrer)
                  ?.visits.toLocaleString()}{' '}
                visits
              </div>
            )}
          </div>
        )}
      >
        {/* Additional client content in children slot */}
        <div style={clientStyles.container} data-testid="client-controls">
          <div style={clientStyles.header}>
            <span style={clientStyles.badge}>CLIENT INTERACTIVE</span>
          </div>
          <p
            style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#166534' }}
          >
            Click a referrer bar above to see details. The bars resize
            responsively based on your browser window width.
          </p>
          <button
            data-testid="clear-selection-btn"
            onClick={() => setSelectedReferrer(null)}
            style={{
              ...clientStyles.button,
              ...clientStyles.primaryButton,
            }}
          >
            Clear Selection
          </button>
        </div>
      </CompositeComponent>

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
            <code>ssr: 'data-only'</code> runs the loader on server but skips
            SSR of the route component
          </li>
          <li>
            The loader fetches both the RSC (blue) and its data on the server -
            both are "data" from the loader's perspective
          </li>
          <li>
            Client visualization (green) uses <code>window.innerWidth</code> for
            responsive charts
          </li>
          <li>The pendingComponent shows briefly while the client hydrates</li>
          <li>
            RSC content is cached - changing selections doesn't refetch server
            data
          </li>
        </ul>
      </div>
    </div>
  )
}
