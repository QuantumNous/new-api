import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  CompositeComponent,
  createCompositeComponent,
} from '@tanstack/react-start/rsc'
import { clientStyles, formatTime, pageStyles } from '~/utils/styles'
import {
  serverBadge,
  serverBox,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'

// ============================================================================
// SLOTS: Dashboard Widget Container
// ============================================================================

const getSlottedServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { title: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Simulate fetching dashboard metrics from server
    const metrics = {
      totalRevenue: 142580,
      activeUsers: 8432,
      conversionRate: 3.2,
    }

    return createCompositeComponent(
      (props: {
        children?: React.ReactNode
        renderFooter?: (data: { count: number }) => React.ReactNode
      }) => {
        return (
          <div style={serverBox} data-testid="rsc-slotted-content">
            <div style={serverHeader}>
              <span style={serverBadge}>SERVER LAYOUT</span>
              <span style={timestamp} data-testid="rsc-slotted-timestamp">
                Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>
            <h2
              style={{ margin: '0 0 16px 0', color: '#0c4a6e' }}
              data-testid="rsc-slotted-title"
            >
              {data.title}
            </h2>

            {/* Server-rendered metrics row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
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
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    textTransform: 'uppercase',
                  }}
                >
                  Revenue
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#0284c7',
                  }}
                >
                  ${metrics.totalRevenue.toLocaleString()}
                </div>
              </div>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    textTransform: 'uppercase',
                  }}
                >
                  Users
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#0284c7',
                  }}
                >
                  {metrics.activeUsers.toLocaleString()}
                </div>
              </div>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: '#f0f9ff',
                  borderRadius: '6px',
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: '#64748b',
                    textTransform: 'uppercase',
                  }}
                >
                  Conversion
                </div>
                <div
                  style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#0284c7',
                  }}
                >
                  {metrics.conversionRate}%
                </div>
              </div>
            </div>

            {/* Client widgets slot */}
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
                  textTransform: 'uppercase',
                  marginBottom: '8px',
                }}
              >
                Interactive Widgets (Client Slot)
              </div>
              <div data-testid="rsc-slotted-children">{props.children}</div>
            </div>

            {/* Footer render prop */}
            <div
              style={{
                borderTop: '1px solid #bae6fd',
                paddingTop: '12px',
              }}
              data-testid="rsc-slotted-footer"
            >
              {props.renderFooter?.({ count: 42 })}
            </div>
          </div>
        )
      },
    )
  })

export const Route = createFileRoute('/rsc-slots')({
  loader: async () => {
    const Server = await getSlottedServerComponent({
      data: { title: 'Revenue Dashboard' },
    })
    return {
      Server,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscSlotsComponent,
  pendingComponent: () => {
    console.log('[PENDING] /rsc-slots')
    return <>Loading...</>
  },
})

function RscSlotsComponent() {
  const { Server, loaderTimestamp } = Route.useLoaderData()
  const [childText, setChildText] = React.useState('initial child')
  const [footerMultiplier, setFooterMultiplier] = React.useState(1)
  const [showExtraChild, setShowExtraChild] = React.useState(false)

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-slots-title" style={pageStyles.title}>
        Dashboard with Interactive Widgets
      </h1>
      <p style={pageStyles.description}>
        The dashboard layout and metrics are server-rendered (blue), but the
        widgets inside are client-interactive (green). Changing the widgets does
        NOT refetch the server component - watch the server timestamp stay
        constant!
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Client Controls */}
      <div style={clientStyles.container} data-testid="controls">
        <div style={clientStyles.header}>
          <span style={clientStyles.badge}>CLIENT CONTROLS</span>
        </div>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#166534' }}>
          Use these buttons to modify the slot content. The server layout won't
          reload!
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            data-testid="change-child-btn"
            onClick={() =>
              setChildText(`Widget updated at ${formatTime(Date.now())}`)
            }
            style={{ ...clientStyles.button, ...clientStyles.primaryButton }}
          >
            Update Widget Text
          </button>
          <button
            data-testid="change-footer-btn"
            onClick={() => setFooterMultiplier((m) => m + 1)}
            style={{ ...clientStyles.button, ...clientStyles.secondaryButton }}
          >
            Increase Footer Value (x{footerMultiplier})
          </button>
          <button
            data-testid="toggle-extra-child-btn"
            onClick={() => setShowExtraChild((s) => !s)}
            style={{ ...clientStyles.button, ...clientStyles.secondaryButton }}
          >
            {showExtraChild ? 'Hide' : 'Show'} Extra Widget
          </button>
        </div>
      </div>

      <CompositeComponent
        src={Server}
        renderFooter={({ count }: { count: number }) => (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#64748b', fontSize: '13px' }}>
              Server provided count: {count}
            </span>
            <span
              data-testid="footer-content"
              style={{
                padding: '4px 12px',
                backgroundColor: '#dcfce7',
                border: '1px solid #16a34a',
                borderRadius: '4px',
                color: '#166534',
                fontWeight: 'bold',
              }}
            >
              Computed: {count * footerMultiplier}
            </span>
          </div>
        )}
      >
        {/* Client widgets rendered inside server slot */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              flex: '1',
              minWidth: '150px',
              padding: '12px',
              backgroundColor: '#dcfce7',
              border: '1px solid #16a34a',
              borderRadius: '6px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#166534',
                marginBottom: '4px',
              }}
            >
              CLIENT WIDGET
            </div>
            <span data-testid="child-content" style={{ color: '#14532d' }}>
              {childText}
            </span>
          </div>
          {showExtraChild && (
            <div
              style={{
                flex: '1',
                minWidth: '150px',
                padding: '12px',
                backgroundColor: '#dcfce7',
                border: '1px solid #16a34a',
                borderRadius: '6px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: '#166534',
                  marginBottom: '4px',
                }}
              >
                EXTRA WIDGET
              </div>
              <span
                data-testid="extra-child-content"
                style={{ color: '#14532d' }}
              >
                Extra widget visible!
              </span>
            </div>
          )}
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
            Server layout (blue) contains slots for client content (green)
          </li>
          <li>Slots can be children or render props</li>
          <li>Changing slot content doesn't refetch the server component</li>
          <li>Server timestamp remains constant while widgets update</li>
        </ul>
      </div>
    </div>
  )
}
