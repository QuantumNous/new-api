import * as React from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
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

const getCachedDataServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { dataType: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()
    const fetchId = Math.random().toString(36).slice(2, 8)

    // Simulate different data based on type
    const dataMap: Record<string, { label: string; value: number }> = {
      users: {
        label: 'Active Users',
        value: Math.floor(Math.random() * 10000),
      },
      orders: { label: 'Orders Today', value: Math.floor(Math.random() * 500) },
      revenue: {
        label: 'Revenue',
        value: Math.floor(Math.random() * 100000),
      },
    }

    const result = dataMap[data.dataType] || {
      label: 'Unknown',
      value: 0,
    }

    return renderServerComponent(
      <div style={serverBox} data-testid="rsc-cached-data">
        <div style={serverHeader}>
          <span style={serverBadge}>CACHED DATA</span>
          <span style={timestamp} data-testid="rsc-cached-timestamp">
            {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>

        <div
          style={{
            padding: '20px',
            backgroundColor: '#f0f9ff',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              color: '#64748b',
              marginBottom: '4px',
            }}
          >
            {result.label}
          </div>
          <div
            style={{
              fontSize: '36px',
              fontWeight: 'bold',
              color: '#0284c7',
            }}
            data-testid="rsc-cached-value"
          >
            {result.value.toLocaleString()}
          </div>
          <div
            style={{
              marginTop: '12px',
              fontSize: '11px',
              color: '#94a3b8',
              fontFamily: 'monospace',
            }}
            data-testid="rsc-cached-fetch-id"
          >
            Fetch ID: {fetchId}
          </div>
        </div>

        <div
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: '#64748b',
            textAlign: 'center',
          }}
        >
          Data type: <strong>{data.dataType}</strong>
        </div>
      </div>,
    )
  })

export const Route = createFileRoute('/rsc-caching')({
  staleTime: 10000, // 10 second stale time for testing
  loader: async () => {
    const CachedData = await getCachedDataServerComponent({
      data: { dataType: 'users' },
    })
    return {
      CachedData,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscCachingComponent,
})

function RscCachingComponent() {
  const { CachedData, loaderTimestamp } = Route.useLoaderData()
  const router = useRouter()
  const [manualInvalidateCount, setManualInvalidateCount] = React.useState(0)

  const handleInvalidate = () => {
    setManualInvalidateCount((c) => c + 1)
    router.invalidate()
  }

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-caching-title" style={pageStyles.title}>
        Analytics Widget - RSC Caching
      </h1>
      <p style={pageStyles.description}>
        This example tests RSC caching behavior. The route has a 10 second
        staleTime. Navigate away and back quickly - you'll see cached data. Wait
        10+ seconds or click "Force Refresh" to refetch. The Fetch ID changes
        only when actually refetched.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Cache Controls */}
      <div style={clientStyles.container} data-testid="cache-controls">
        <div style={clientStyles.header}>
          <span style={clientStyles.badge}>CACHE CONTROLS</span>
          <span style={{ fontSize: '12px', color: '#166534' }}>
            staleTime: 10s
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            data-testid="force-refresh-btn"
            onClick={handleInvalidate}
            style={{ ...clientStyles.button, ...clientStyles.primaryButton }}
          >
            Force Refresh (Invalidate)
          </button>
          <span
            style={{ fontSize: '12px', color: '#64748b' }}
            data-testid="invalidate-count"
          >
            Manual invalidations: {manualInvalidateCount}
          </span>
        </div>

        <div
          style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: '#f0fdf4',
            borderRadius: '6px',
            fontSize: '13px',
          }}
        >
          <strong style={{ color: '#166534' }}>Testing Instructions:</strong>
          <ol
            style={{
              margin: '8px 0 0 0',
              paddingLeft: '20px',
              color: '#166534',
            }}
          >
            <li>Note the current Fetch ID below</li>
            <li>Navigate to another page and back within 10s</li>
            <li>Fetch ID should be the same (cached!)</li>
            <li>Wait 10s and navigate back, or click "Force Refresh"</li>
            <li>Fetch ID should change (refetched!)</li>
          </ol>
        </div>
      </div>

      {/* Cached Data RSC */}
      {CachedData}

      {/* Cache Status Info */}
      <div
        style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
          }}
        >
          <span style={{ fontSize: '18px' }}>⏱️</span>
          <strong style={{ color: '#92400e' }}>Cache Status</strong>
        </div>
        <div style={{ fontSize: '13px', color: '#78350f' }}>
          <div>
            Data fetched at: <strong>{formatTime(loaderTimestamp)}</strong>
          </div>
          <div>
            Will become stale at:{' '}
            <strong>{formatTime(loaderTimestamp + 10000)}</strong>
          </div>
        </div>
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
          <li>staleTime: 10000 prevents refetch for 10 seconds</li>
          <li>Navigation within staleTime uses cached RSC</li>
          <li>router.invalidate() forces immediate refetch</li>
          <li>After staleTime, next navigation triggers refetch</li>
        </ul>
      </div>
    </div>
  )
}
