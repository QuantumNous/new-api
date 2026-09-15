import * as React from 'react'
import { createFileRoute, useHydrated } from '@tanstack/react-router'
import { CompositeComponent } from '@tanstack/react-start/rsc'
import { streamNotificationsGenerator } from '~/utils/streamingServerComponents'
import {
  asyncStyles,
  clientStyles,
  formatTime,
  pageStyles,
  serverStyles,
} from '~/utils/styles'

export const Route = createFileRoute('/rsc-stream-loader')({
  loader: async () => {
    // Return the generator directly - don't await it!
    // The component will consume the stream progressively
    const notificationStream = await streamNotificationsGenerator({
      data: { initialCount: 3, streamCount: 4, delayMs: 500 },
    })

    return {
      notificationStream,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscStreamLoaderComponent,
  pendingComponent: () => {
    console.log('[PENDING] /rsc-stream-loader')
    return <>Loading...</>
  },
})

type NotificationRSC = any

function RscStreamLoaderComponent() {
  const { notificationStream, loaderTimestamp } = Route.useLoaderData()
  const hydrated = useHydrated()
  const [notifications, setNotifications] = React.useState<
    Array<NotificationRSC>
  >([])
  const [isStreaming, setIsStreaming] = React.useState(true)
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set())
  const streamStartedRef = React.useRef(false)

  // Consume the stream in the component
  React.useEffect(() => {
    // Prevent double-execution in strict mode
    if (streamStartedRef.current) return
    streamStartedRef.current = true

    async function consumeStream() {
      try {
        for await (const notification of notificationStream) {
          setNotifications((prev) => [...prev, notification])
        }
      } finally {
        setIsStreaming(false)
      }
    }

    consumeStream()
  }, [notificationStream])

  const toggleExpanded = React.useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-stream-loader-title" style={pageStyles.title}>
        Streaming RSCs via Loader
      </h1>
      <p style={pageStyles.description}>
        This page demonstrates RSC streaming where the stream is initiated in
        the route loader but consumed progressively in the component. Watch as
        notifications appear one by one without any button click! This works for
        both SSR and client-side navigation.
      </p>

      {/* Timing info */}
      <div
        style={{
          ...serverStyles.container,
          marginBottom: '16px',
        }}
        data-testid="timing-info"
      >
        <div style={serverStyles.header}>
          <span style={serverStyles.badge}>LOADER INFO</span>
        </div>
        <div style={{ fontSize: '13px', color: '#0c4a6e' }}>
          <div>
            <span data-testid="loader-timestamp" style={{ display: 'none' }}>
              {loaderTimestamp}
            </span>
            Loader executed at: {formatTime(loaderTimestamp)}
          </div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
            Stream returned from loader, consumed progressively in component
          </div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ ...pageStyles.legend, marginBottom: '16px' }}>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor('#0284c7')} />
          <span style={pageStyles.legendText}>Server Component (RSC)</span>
        </div>
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor('#16a34a')} />
          <span style={pageStyles.legendText}>Client Interactive</span>
        </div>
      </div>

      {/* Streaming Status */}
      {isStreaming && (
        <div style={asyncStyles.container} data-testid="streaming-status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={asyncStyles.badge}>STREAMING</span>
            <span
              style={{ fontSize: '13px', color: '#92400e' }}
              data-testid="notification-count"
            >
              Received {notifications.length} notification(s)...
            </span>
          </div>
          <div style={asyncStyles.loadingBar}>
            <div
              style={{
                ...asyncStyles.loadingProgress,
                width: '100%',
                animation: 'loading 1s ease-in-out infinite',
              }}
            />
          </div>
        </div>
      )}

      {/* Stream Complete Status */}
      {!isStreaming && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#dcfce7',
            border: '2px solid #16a34a',
            borderRadius: '8px',
            marginBottom: '16px',
          }}
          data-testid="stream-complete"
        >
          <span style={clientStyles.badge}>COMPLETE</span>
          <span
            style={{ marginLeft: '8px', fontSize: '13px', color: '#166534' }}
            data-testid="final-count"
          >
            Stream finished! Received {notifications.length} notifications.
          </span>
        </div>
      )}

      {/* Notification List */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        data-testid="notification-list"
      >
        {notifications.map((notificationSrc, index) => (
          <CompositeComponent
            key={index}
            src={notificationSrc}
            renderActions={({ id }: { id: string }) => (
              <div
                style={{
                  display: 'flex',
                  gap: '8px',
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: '#dcfce7',
                  borderRadius: '6px',
                  border: '1px solid #16a34a',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: '#166534',
                    fontWeight: 'bold',
                  }}
                >
                  CLIENT ACTIONS
                </span>
                <button
                  data-testid={`expand-btn-${index}`}
                  onClick={() => toggleExpanded(id)}
                  disabled={!hydrated}
                  style={{
                    ...clientStyles.button,
                    ...clientStyles.secondaryButton,
                    padding: '4px 8px',
                    fontSize: '11px',
                  }}
                >
                  {expandedIds.has(id) ? 'Collapse' : 'Expand'}
                </button>
                {expandedIds.has(id) && (
                  <span
                    data-testid={`expanded-content-${index}`}
                    style={{ fontSize: '12px', color: '#166534' }}
                  >
                    Expanded view for {id}
                  </span>
                )}
              </div>
            )}
          />
        ))}
      </div>

      {/* Empty State during initial load */}
      {notifications.length === 0 && isStreaming && (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            color: '#64748b',
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            border: '2px dashed #f59e0b',
          }}
          data-testid="loading-state"
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</div>
          <div>Waiting for first notification to stream in...</div>
        </div>
      )}

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
          <li>Stream is returned from loader, not awaited</li>
          <li>Component consumes stream progressively in useEffect</li>
          <li>Notifications appear one by one as they arrive</li>
          <li>No button click needed - streaming starts automatically</li>
          <li>Works for both SSR and client-side navigation</li>
          <li>Client slots still work on each streamed RSC</li>
        </ul>
      </div>
    </div>
  )
}
