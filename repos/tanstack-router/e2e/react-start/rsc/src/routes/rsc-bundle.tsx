import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  renderServerComponent,
  createCompositeComponent,
  CompositeComponent,
} from '@tanstack/react-start/rsc'
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

const getPageLayoutBundle = createServerFn({ method: 'GET' })
  .validator((data: { pageTitle: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()
    const bundleId = Math.random().toString(36).slice(2, 8)

    // Simulate fetching different parts of a page layout
    const headerData = {
      logo: 'TechCorp',
      navItems: ['Products', 'Solutions', 'Pricing', 'About'],
      user: { name: 'John Doe', avatar: 'JD' },
    }

    const contentData = {
      title: data.pageTitle,
      subtitle: 'Welcome to your dashboard',
      stats: [
        { label: 'Total Users', value: 12847 },
        { label: 'Active Sessions', value: 342 },
        { label: 'Revenue', value: 45231 },
      ],
    }

    const footerData = {
      copyright: '2024 TechCorp Inc.',
      links: ['Privacy', 'Terms', 'Contact'],
      version: 'v2.4.1',
    }

    // Create multiple RSCs in parallel
    // Header and Content use createCompositeComponent (they have slots)
    // Footer uses renderServerComponent (no slots)
    const [Header, Content, Footer] = await Promise.all([
      createCompositeComponent((props: { children?: React.ReactNode }) => {
        return (
          <header
            style={{
              ...serverBox,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
            data-testid="rsc-bundle-header"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: '#0284c7',
                }}
                data-testid="rsc-bundle-logo"
              >
                {headerData.logo}
              </div>
              <nav style={{ display: 'flex', gap: '16px' }}>
                {headerData.navItems.map((item) => (
                  <a
                    key={item}
                    href="#"
                    style={{
                      color: '#0369a1',
                      textDecoration: 'none',
                      fontSize: '14px',
                    }}
                  >
                    {item}
                  </a>
                ))}
              </nav>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={serverBadge}>HEADER RSC</span>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '12px',
                  fontWeight: 'bold',
                }}
                data-testid="rsc-bundle-avatar"
              >
                {headerData.user.avatar}
              </div>
              {props.children}
            </div>
          </header>
        )
      }),
      createCompositeComponent(
        (props: { renderActions?: () => React.ReactNode }) => {
          return (
            <main
              style={{
                ...serverBox,
                minHeight: '200px',
              }}
              data-testid="rsc-bundle-content"
            >
              <div style={serverHeader}>
                <span style={serverBadge}>CONTENT RSC</span>
                <span
                  style={timestamp}
                  data-testid="rsc-bundle-content-timestamp"
                >
                  {new Date(serverTimestamp).toLocaleTimeString()}
                </span>
              </div>

              <h1
                style={{ margin: '0 0 4px 0', color: '#0c4a6e' }}
                data-testid="rsc-bundle-title"
              >
                {contentData.title}
              </h1>
              <p
                style={{ margin: '0 0 20px 0', color: '#64748b' }}
                data-testid="rsc-bundle-subtitle"
              >
                {contentData.subtitle}
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                  marginBottom: '16px',
                }}
              >
                {contentData.stats.map((stat) => (
                  <div
                    key={stat.label}
                    style={{
                      padding: '16px',
                      backgroundColor: '#f0f9ff',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}
                    data-testid={`rsc-bundle-stat-${stat.label.toLowerCase().replace(' ', '-')}`}
                  >
                    <div
                      style={{
                        fontSize: '28px',
                        fontWeight: 'bold',
                        color: '#0284c7',
                      }}
                    >
                      {stat.value.toLocaleString()}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                      {stat.label}
                    </div>
                  </div>
                ))}
              </div>

              {props.renderActions && (
                <div
                  style={{
                    borderTop: '1px solid #bae6fd',
                    paddingTop: '16px',
                  }}
                  data-testid="rsc-bundle-actions"
                >
                  {props.renderActions()}
                </div>
              )}
            </main>
          )
        },
      ),
      renderServerComponent(
        <footer
          style={{
            ...serverBox,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          data-testid="rsc-bundle-footer"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={serverBadge}>FOOTER RSC</span>
            <span
              style={{ fontSize: '13px', color: '#64748b' }}
              data-testid="rsc-bundle-copyright"
            >
              {footerData.copyright}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            {footerData.links.map((link) => (
              <a
                key={link}
                href="#"
                style={{
                  color: '#0369a1',
                  textDecoration: 'none',
                  fontSize: '13px',
                }}
              >
                {link}
              </a>
            ))}
          </div>
          <span
            style={{
              fontSize: '12px',
              color: '#94a3b8',
              fontFamily: 'monospace',
            }}
            data-testid="rsc-bundle-version"
          >
            {footerData.version}
          </span>
        </footer>,
      ),
    ])

    // Return multiple RSCs in a single object
    return {
      bundleId,
      timestamp: serverTimestamp,
      Header,
      Content,
      Footer,
    }
  })

export const Route = createFileRoute('/rsc-bundle')({
  loader: async () => {
    // Single server function returns multiple RSCs in an object
    const bundle = await getPageLayoutBundle({
      data: { pageTitle: 'Dashboard Overview' },
    })
    return {
      ...bundle,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscBundleComponent,
})

function RscBundleComponent() {
  const { Header, Content, Footer, bundleId, timestamp, loaderTimestamp } =
    Route.useLoaderData()
  const [actionCount, setActionCount] = React.useState(0)

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-bundle-page-title" style={pageStyles.title}>
        Page Layout Bundle - Multiple RSCs from Single Server Function
      </h1>
      <p style={pageStyles.description}>
        This example demonstrates returning multiple RSCs from a single server
        function call. The Header, Content, and Footer are all returned as an
        object, allowing for efficient bundled loading while maintaining
        independent render behavior.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        <span data-testid="bundle-id" style={{ display: 'none' }}>
          {bundleId}
        </span>
        <span data-testid="bundle-timestamp" style={{ display: 'none' }}>
          {timestamp}
        </span>
        Bundle ID: {bundleId} | Loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* All three RSCs from the same bundle */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {/* Header RSC with client slot for user menu */}
        <CompositeComponent src={Header}>
          <button
            data-testid="user-menu-btn"
            onClick={() => setActionCount((c) => c + 1)}
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: '#16a34a',
              color: 'white',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Menu
          </button>
        </CompositeComponent>

        {/* Content RSC with render prop for actions */}
        <CompositeComponent
          src={Content}
          renderActions={() => (
            <div style={clientStyles.container} data-testid="content-actions">
              <div style={clientStyles.header}>
                <span style={clientStyles.badge}>CLIENT ACTIONS</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center',
                }}
              >
                <button
                  data-testid="action-btn"
                  onClick={() => setActionCount((c) => c + 1)}
                  style={{
                    ...clientStyles.button,
                    ...clientStyles.primaryButton,
                  }}
                >
                  Perform Action
                </button>
                <span
                  data-testid="action-count"
                  style={{ fontSize: '14px', color: '#166534' }}
                >
                  Actions performed: {actionCount}
                </span>
              </div>
            </div>
          )}
        />

        {/* Footer RSC - no slots, use directly */}
        {Footer}
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
            All three RSCs (Header, Content, Footer) are returned from a single
            server function call
          </li>
          <li>
            Each RSC renders independently with the same server timestamp
            (fetched together)
          </li>
          <li>
            The bundle includes metadata (bundleId, timestamp) alongside the
            RSCs
          </li>
          <li>
            Client components can be slotted into any of the bundled RSCs via
            children or render props
          </li>
          <li>
            This pattern is efficient for page layouts where multiple sections
            are needed together
          </li>
        </ul>
      </div>
    </div>
  )
}
