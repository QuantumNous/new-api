import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { formatTime, pageStyles } from '~/utils/styles'

// ============================================================================
// Server Component Definition
// ============================================================================

const getLinkServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { targetRoute: string; linkText: string }) => data)
  .handler(async ({ data }) => {
    const { Link } = await import('@tanstack/react-router')
    const serverTimestamp = Date.now()

    return renderServerComponent(
      <div style={serverBox} data-testid="rsc-link-content">
        <div style={serverHeader}>
          <span style={serverBadge}>SERVER EMAIL</span>
          <span style={timestamp} data-testid="rsc-link-timestamp">
            {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>

        {/* Email Header */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '12px',
              color: '#64748b',
              marginBottom: '4px',
            }}
          >
            From: notifications@example.com
          </div>
          <h3 style={{ margin: '0 0 4px 0', color: '#0c4a6e' }}>
            Your Weekly Summary is Ready
          </h3>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Received today at {new Date(serverTimestamp).toLocaleTimeString()}
          </div>
        </div>

        {/* Email Body */}
        <div
          style={{
            padding: '16px',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            marginBottom: '16px',
          }}
        >
          <p
            style={{
              margin: '0 0 12px 0',
              color: '#334155',
              lineHeight: '1.6',
            }}
            data-testid="rsc-link-message"
          >
            Hi there! Your weekly activity report is ready. You had 47 new
            visitors and 12 conversions this week. Click below to view the full
            report.
          </p>
          <Link
            to={data.targetRoute as '/'}
            data-testid="rsc-link"
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#0284c7',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            {data.linkText}
          </Link>
        </div>

        <div style={{ fontSize: '12px', color: '#94a3b8' }}>
          This Link component is rendered on the server but provides client-side
          navigation.
        </div>
      </div>,
    )
  })

export const Route = createFileRoute('/rsc-link')({
  loader: async () => {
    const Server = await getLinkServerComponent({
      data: { targetRoute: '/', linkText: 'View Full Report' },
    })
    return {
      Server,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscLinkComponent,
})

function RscLinkComponent() {
  const { Server, loaderTimestamp } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-link-title" style={pageStyles.title}>
        Email Notification - RSC with Link
      </h1>
      <p style={pageStyles.description}>
        This RSC contains a TanStack Router Link component. Even though the
        entire email is server-rendered, the Link provides client-side
        navigation without a full page reload.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {Server}

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
          <li>Link component from @tanstack/react-router works inside RSC</li>
          <li>
            Clicking the link performs client-side navigation (no full reload)
          </li>
          <li>The RSC is entirely server-rendered including the Link</li>
          <li>Link is serialized as a client reference for hydration</li>
        </ul>
      </div>

      <div
        style={{
          marginTop: '16px',
          padding: '16px',
          backgroundColor: '#fef3c7',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#92400e',
        }}
      >
        <strong>Try it:</strong> Click the "View Full Report" button in the
        email above. Notice the URL changes without a full page reload - that's
        client-side navigation from a server-rendered Link!
      </div>
    </div>
  )
}
