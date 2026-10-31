import * as React from 'react'
import { createFileRoute, useHydrated } from '@tanstack/react-router'
import { CompositeComponent } from '@tanstack/react-start/rsc'
import { streamNotificationsGenerator } from '~/utils/streamingServerComponents'
import {
  pageStyles,
  clientStyles,
  serverStyles,
  asyncStyles,
  formatTime,
} from '~/utils/styles'

export const Route = createFileRoute('/rsc-stream-generator')({
  component: RscStreamGeneratorComponent,
  pendingComponent: () => {
    console.log('[PENDING] /rsc-stream-generator')
    return <>Loading...</>
  },
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotificationRSC = any

function RscStreamGeneratorComponent() {
  const hydrated = useHydrated()
  const [notifications, setNotifications] = React.useState<
    Array<NotificationRSC>
  >([])
  const [isStreaming, setIsStreaming] = React.useState(false)
  const [streamComplete, setStreamComplete] = React.useState(false)
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set())
  const [startTime, setStartTime] = React.useState<number | null>(null)

  const startStreaming = React.useCallback(async () => {
    setNotifications([])
    setIsStreaming(true)
    setStreamComplete(false)
    setDismissedIds(new Set())
    setStartTime(Date.now())

    try {
      const generator = await streamNotificationsGenerator({
        data: { initialCount: 3, streamCount: 4, delayMs: 800 },
      })

      for await (const notification of generator) {
        setNotifications((prev) => [...prev, notification as NotificationRSC])
      }
    } finally {
      setIsStreaming(false)
      setStreamComplete(true)
    }
  }, [])

  const toggleDismissed = React.useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const visibleNotifications = notifications.filter(
    (_, index) => !dismissedIds.has(`notif_${index}`),
  )

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-stream-generator-title" style={pageStyles.title}>
        Streaming RSCs - Async Generator Pattern
      </h1>
      <p style={pageStyles.description}>
        This demonstrates streaming individual React Server Components from the
        server using an async generator function. This pattern provides cleaner
        syntax with for-await-of loops. Each notification is a complete RSC with
        interactive client slots.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        {startTime && (
          <span data-testid="stream-start-time">
            Stream started at: {formatTime(startTime)}
          </span>
        )}
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
        <div style={pageStyles.legendItem}>
          <span style={pageStyles.legendColor('#f59e0b')} />
          <span style={pageStyles.legendText}>Streaming</span>
        </div>
      </div>

      {/* Controls */}
      <div style={clientStyles.container} data-testid="controls">
        <div style={clientStyles.header}>
          <span style={clientStyles.badge}>CLIENT CONTROLS</span>
        </div>
        <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#166534' }}>
          Click the button to start streaming notifications using an async
          generator. The code uses a clean for-await-of loop pattern.
        </p>
        <button
          data-testid="start-stream-btn"
          onClick={startStreaming}
          disabled={isStreaming || !hydrated}
          style={{
            ...clientStyles.button,
            ...clientStyles.primaryButton,
            opacity: isStreaming ? 0.6 : 1,
            cursor: isStreaming ? 'not-allowed' : 'pointer',
          }}
        >
          {isStreaming ? 'Streaming...' : 'Start Streaming Notifications'}
        </button>
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
      {streamComplete && !isStreaming && (
        <div
          style={{
            ...serverStyles.container,
            backgroundColor: '#dcfce7',
            border: '2px solid #16a34a',
          }}
          data-testid="stream-complete"
        >
          <span style={{ ...serverStyles.badge, backgroundColor: '#16a34a' }}>
            COMPLETE
          </span>
          <span
            style={{ marginLeft: '8px', fontSize: '13px', color: '#166534' }}
            data-testid="final-count"
          >
            Stream finished! Received {notifications.length} notifications.
            {dismissedIds.size > 0 && ` (${dismissedIds.size} dismissed)`}
          </span>
        </div>
      )}

      {/* Notification List */}
      <div
        style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
        data-testid="notification-list"
      >
        {notifications.map((notificationSrc, index) => {
          const id = `notif_${index}`
          const isDismissed = dismissedIds.has(id)

          return (
            <div
              key={index}
              style={{
                opacity: isDismissed ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
              data-testid={`notification-wrapper-${index}`}
            >
              <CompositeComponent
                src={notificationSrc}
                renderActions={({ id: notifId }: { id: string }) => (
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
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
                      data-testid={`dismiss-btn-${index}`}
                      onClick={() => toggleDismissed(id)}
                      disabled={!hydrated}
                      style={{
                        ...clientStyles.button,
                        ...clientStyles.secondaryButton,
                        padding: '4px 8px',
                        fontSize: '11px',
                      }}
                    >
                      {isDismissed ? 'Restore' : 'Dismiss'}
                    </button>
                    {isDismissed && (
                      <span
                        data-testid={`dismissed-label-${index}`}
                        style={{ fontSize: '12px', color: '#dc2626' }}
                      >
                        Dismissed
                      </span>
                    )}
                    <span
                      data-testid={`action-notif-id-${index}`}
                      style={{
                        fontSize: '11px',
                        color: '#64748b',
                        marginLeft: 'auto',
                      }}
                    >
                      ID: {notifId}
                    </span>
                  </div>
                )}
              />
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {notifications.length === 0 && !isStreaming && (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            color: '#64748b',
            backgroundColor: '#f8fafc',
            borderRadius: '8px',
          }}
          data-testid="empty-state"
        >
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>📭</div>
          <div>
            No notifications yet. Click the button above to start streaming!
          </div>
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
          <li>Uses async generator function (async function*)</li>
          <li>Cleaner consumption with for-await-of loop</li>
          <li>Each notification is a complete RSC with server data</li>
          <li>Client slots provide dismiss/restore functionality</li>
          <li>First 3 notifications arrive immediately (batched)</li>
        </ul>
      </div>
    </div>
  )
}
