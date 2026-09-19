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
import { pageStyles, clientStyles, formatTime } from '~/utils/styles'

// ============================================================================
// Server Component Definition
// ============================================================================

const getLargePayloadServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { itemCount: number }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Generate large dataset
    const items = Array.from({ length: data.itemCount }, (_, i) => ({
      id: `item_${i + 1}`,
      name: `Product ${i + 1}`,
      description: `This is a detailed description for product ${i + 1}. It contains enough text to simulate a realistic product listing.`,
      price: Math.floor(Math.random() * 1000) + 10,
      inStock: Math.random() > 0.3,
      rating: (Math.random() * 2 + 3).toFixed(1),
    }))

    return renderServerComponent(
      <div style={serverBox} data-testid="rsc-large-payload">
        <div style={serverHeader}>
          <span style={serverBadge}>LARGE PAYLOAD</span>
          <span style={timestamp} data-testid="rsc-large-timestamp">
            {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '12px',
          }}
        >
          <h3 style={{ margin: 0, color: '#0c4a6e' }}>Product Catalog</h3>
          <span
            style={{
              padding: '4px 8px',
              backgroundColor: '#f0f9ff',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#0369a1',
            }}
            data-testid="rsc-large-count"
          >
            {items.length} items
          </span>
        </div>

        <div
          style={{
            maxHeight: '400px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
          data-testid="rsc-large-items"
        >
          {items.map((item) => (
            <div
              key={item.id}
              style={{
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #bae6fd',
              }}
              data-testid={`large-item-${item.id}`}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <span style={{ fontWeight: 'bold', color: '#0c4a6e' }}>
                  {item.name}
                </span>
                <span style={{ fontWeight: 'bold', color: '#0284c7' }}>
                  ${item.price}
                </span>
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: '#64748b',
                  marginBottom: '4px',
                }}
              >
                {item.description}
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  fontSize: '11px',
                }}
              >
                <span style={{ color: '#f59e0b' }}>★ {item.rating}</span>
                <span style={{ color: item.inStock ? '#16a34a' : '#dc2626' }}>
                  {item.inStock ? 'In Stock' : 'Out of Stock'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>,
    )
  })

type LargeSearchParams = {
  count?: number
}

export const Route = createFileRoute('/rsc-large')({
  validateSearch: (search: Record<string, unknown>): LargeSearchParams => ({
    count: Number(search.count) || 50,
  }),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    const startTime = Date.now()
    const LargePayload = await getLargePayloadServerComponent({
      data: { itemCount: deps.search.count || 50 },
    })
    const loadTime = Date.now() - startTime
    return {
      LargePayload,
      loaderTimestamp: Date.now(),
      loadTime,
      itemCount: deps.search.count || 50,
    }
  },
  component: RscLargeComponent,
})

function RscLargeComponent() {
  const { LargePayload, loaderTimestamp, loadTime, itemCount } =
    Route.useLoaderData()
  const [renderStart] = React.useState(Date.now())
  const [renderTime, setRenderTime] = React.useState<number | null>(null)

  React.useEffect(() => {
    setRenderTime(Date.now() - renderStart)
  }, [renderStart])

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-large-title" style={pageStyles.title}>
        Product Catalog - Large RSC Payload
      </h1>
      <p style={pageStyles.description}>
        This example tests RSC performance with large payloads. The RSC renders
        {itemCount} products. Adjust the count to test different payload sizes.
        Monitor the load time and render time metrics.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Size Controls */}
      <div style={clientStyles.container} data-testid="size-controls">
        <div style={clientStyles.header}>
          <span style={clientStyles.badge}>PAYLOAD SIZE</span>
          <span style={{ fontSize: '12px', color: '#166534' }}>
            Current: {itemCount} items
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            marginBottom: '12px',
          }}
        >
          {[10, 50, 100, 200, 500].map((count) => (
            <a
              key={count}
              href={`/rsc-large?count=${count}`}
              data-testid={`size-${count}`}
              style={{
                ...clientStyles.button,
                ...(itemCount === count
                  ? clientStyles.primaryButton
                  : clientStyles.secondaryButton),
                textDecoration: 'none',
              }}
            >
              {count} items
            </a>
          ))}
        </div>

        {/* Performance Metrics */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginTop: '12px',
          }}
        >
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f0fdf4',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11px', color: '#64748b' }}>Item Count</div>
            <div
              style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}
              data-testid="metric-count"
            >
              {itemCount}
            </div>
          </div>
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f0fdf4',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Server Load Time
            </div>
            <div
              style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}
              data-testid="metric-load-time"
            >
              {loadTime}ms
            </div>
          </div>
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f0fdf4',
              borderRadius: '6px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Client Render Time
            </div>
            <div
              style={{ fontSize: '24px', fontWeight: 'bold', color: '#16a34a' }}
              data-testid="metric-render-time"
            >
              {renderTime !== null ? `${renderTime}ms` : '...'}
            </div>
          </div>
        </div>
      </div>

      {/* Large Payload RSC */}
      {LargePayload}

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
          <li>Tests RSC with varying payload sizes (10-500 items)</li>
          <li>Measures server load time and client render time</li>
          <li>Large payloads may benefit from streaming</li>
          <li>Virtual scrolling could improve very large lists</li>
        </ul>
      </div>
    </div>
  )
}
