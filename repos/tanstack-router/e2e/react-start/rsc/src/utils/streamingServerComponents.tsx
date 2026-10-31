import { createServerFn } from '@tanstack/react-start'
import { createCompositeComponent } from '@tanstack/react-start/rsc'
import { serverBox, serverBadge, serverHeader, timestamp } from './serverStyles'

// ============================================================================
// STREAMING: Notification components streamed via ReadableStream or AsyncGenerator
// Used by: rsc-stream-readable.tsx, rsc-stream-generator.tsx, rsc-stream-loader.tsx
// ============================================================================

type NotificationData = {
  id: string
  title: string
  message: string
  timestamp: number
  source: string
}

function generateNotification(index: number): NotificationData {
  const sources = ['System', 'User', 'API', 'Database', 'Security', 'Analytics']
  const messages = [
    'New user registration completed successfully',
    'Database backup finished without errors',
    'API rate limit approaching threshold',
    'Security scan detected no vulnerabilities',
    'Weekly analytics report is ready',
    'Server maintenance scheduled for tonight',
    'New feature deployment completed',
    'Cache invalidation triggered',
  ]

  return {
    id: `notif_${index}_${Math.random().toString(36).slice(2, 8)}`,
    title: `Notification ${index + 1}`,
    message: messages[index % messages.length],
    timestamp: Date.now(),
    source: sources[index % sources.length],
  }
}

async function createNotificationRSC(notification: NotificationData) {
  return createCompositeComponent(
    (props: { renderActions?: (data: { id: string }) => React.ReactNode }) => {
      return (
        <div style={serverBox} data-testid={`notification-${notification.id}`}>
          <div style={serverHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={serverBadge}>SERVER COMPONENT</span>
              <span
                style={{
                  fontSize: '11px',
                  color: '#0c4a6e',
                  fontWeight: 'bold',
                }}
              >
                {notification.source}
              </span>
            </div>
            <span
              style={timestamp}
              data-testid={`timestamp-${notification.id}`}
            >
              {new Date(notification.timestamp).toLocaleTimeString()}
            </span>
          </div>

          <div style={{ flex: 1 }}>
            <h3
              style={{ margin: '0 0 4px 0', color: '#0c4a6e' }}
              data-testid={`title-${notification.id}`}
            >
              {notification.title}
            </h3>
            <p
              style={{ margin: 0, fontSize: '14px', color: '#64748b' }}
              data-testid={`message-${notification.id}`}
            >
              {notification.message}
            </p>
            <div
              style={{
                marginTop: '8px',
                fontSize: '11px',
                color: '#94a3b8',
              }}
              data-testid={`id-${notification.id}`}
            >
              ID: {notification.id}
            </div>
          </div>

          {/* Client slot for interactive actions */}
          {props.renderActions?.({ id: notification.id })}
        </div>
      )
    },
  )
}

/**
 * Streams notification RSCs using ReadableStream pattern.
 * First `initialCount` notifications arrive immediately (batched),
 * then `streamCount` more stream in with delays.
 */
export const streamNotificationsReadable = createServerFn({ method: 'GET' })
  .validator(
    (data: { initialCount: number; streamCount: number; delayMs: number }) =>
      data,
  )
  .handler(async ({ data }) => {
    const { initialCount, streamCount, delayMs } = data

    // Return a typed ReadableStream of server components
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial batch immediately
        for (let i = 0; i < initialCount; i++) {
          const notification = generateNotification(i)
          const rsc = await createNotificationRSC(notification)
          controller.enqueue(rsc)
        }

        // Stream remaining with delays
        for (let i = 0; i < streamCount; i++) {
          await new Promise((resolve) => setTimeout(resolve, delayMs))
          const notification = generateNotification(initialCount + i)
          const rsc = await createNotificationRSC(notification)
          controller.enqueue(rsc)
        }

        controller.close()
      },
    })

    return stream
  })

/**
 * Streams notification RSCs using async generator pattern.
 * First `initialCount` notifications arrive immediately (batched),
 * then `streamCount` more stream in with delays.
 */
export const streamNotificationsGenerator = createServerFn({ method: 'GET' })
  .validator(
    (data: { initialCount: number; streamCount: number; delayMs: number }) =>
      data,
  )
  .handler(async function* ({ data }) {
    const { initialCount, streamCount, delayMs } = data

    // Yield initial batch immediately
    for (let i = 0; i < initialCount; i++) {
      const notification = generateNotification(i)
      const rsc = await createNotificationRSC(notification)
      yield rsc
    }

    // Stream remaining with delays
    for (let i = 0; i < streamCount; i++) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      const notification = generateNotification(initialCount + i)
      const rsc = await createNotificationRSC(notification)
      yield rsc
    }
  })
