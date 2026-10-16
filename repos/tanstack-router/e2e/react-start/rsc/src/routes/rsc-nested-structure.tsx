import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  CompositeComponent,
  createCompositeComponent,
  renderServerComponent,
} from '@tanstack/react-start/rsc'
import { pageStyles, clientStyles, formatTime } from '~/utils/styles'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'

// ============================================================================
// NESTED STRUCTURE: Multiple server components with slots in a single return
// ============================================================================

const getNestedServerComponents = createServerFn({ method: 'GET' })
  .validator((data: { title: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Simulate fetching data from different sources
    const headerData = {
      title: data.title,
      subtitle: 'Nested RSC Structure Demo',
    }

    const statsData = {
      views: 12543,
      likes: 847,
      shares: 234,
    }

    const footerData = {
      lastUpdated: new Date(serverTimestamp).toLocaleString(),
      version: '1.0.0',
    }

    // Return an object structure with multiple ReactNodes
    // Each nested component uses the same flat props for slots
    return createCompositeComponent(
      (props: {
        children?: React.ReactNode
        renderExtra?: (data: { total: number }) => React.ReactNode
        renderActions?: (data: { version: string }) => React.ReactNode
      }) => ({
        // Top-level component with children slot
        Header: (
          <div style={serverBox} data-testid="rsc-nested-header">
            <div style={serverHeader}>
              <span style={serverBadge}>SERVER HEADER</span>
              <span style={timestamp} data-testid="rsc-header-timestamp">
                Rendered: {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>
            <h2
              style={{ margin: '0 0 4px 0', color: '#0c4a6e' }}
              data-testid="rsc-header-title"
            >
              {headerData.title}
            </h2>
            <p style={{ margin: 0, color: '#0369a1' }}>{headerData.subtitle}</p>
            {/* Children slot */}
            {props.children}
          </div>
        ),

        // Nested structure
        content: {
          Stats: (
            <div style={serverBox} data-testid="rsc-nested-stats">
              <div style={serverHeader}>
                <span style={serverBadge}>SERVER STATS</span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '16px',
                  marginTop: '12px',
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#0284c7',
                    }}
                    data-testid="rsc-stat-views"
                  >
                    {statsData.views.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Views
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#0284c7',
                    }}
                    data-testid="rsc-stat-likes"
                  >
                    {statsData.likes.toLocaleString()}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Likes
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: '#0284c7',
                    }}
                    data-testid="rsc-stat-shares"
                  >
                    {statsData.shares}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Shares
                  </div>
                </div>
              </div>
              {/* Render prop slot - passes server data to client */}
              {props.renderExtra?.({
                total: statsData.views + statsData.likes + statsData.shares,
              })}
            </div>
          ),

          // Even deeper nesting with children slot
          details: {
            Info: (
              <div style={serverBox} data-testid="rsc-nested-info">
                <div style={serverHeader}>
                  <span style={serverBadge}>SERVER INFO</span>
                </div>
                <p
                  style={{ margin: '12px 0 0 0', color: '#0369a1' }}
                  data-testid="rsc-info-text"
                >
                  This component is deeply nested at content.details.Info
                </p>
                {/* Children slot */}
                {props.children}
              </div>
            ),
          },
        },

        // Footer with both children and render prop slots
        Footer: (
          <div style={serverBox} data-testid="rsc-nested-footer">
            <div style={serverHeader}>
              <span style={serverBadge}>SERVER FOOTER</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '12px',
                fontSize: '13px',
                color: '#64748b',
              }}
            >
              <span data-testid="rsc-footer-updated">
                Last updated: {footerData.lastUpdated}
              </span>
              <span data-testid="rsc-footer-version">
                v{footerData.version}
              </span>
            </div>
            {/* Children slot */}
            {props.children}
            {/* Render prop slot - passes server data to client */}
            {props.renderActions?.({ version: footerData.version })}
          </div>
        ),
      }),
    )
  })

// ============================================================================
// DESTRUCTURED PATTERN: Same structure, accessed via destructuring
// ============================================================================

const getNestedRenderableParts = createServerFn({ method: 'GET' }).handler(
  async () => {
    const serverTimestamp = Date.now()

    const serverNode = {
      foo: {
        bar: (
          <div style={serverBox} data-testid="rsc-nested-renderable-bar">
            <div style={serverHeader}>
              <span style={serverBadge}>SERVER RENDERABLE BAR</span>
              <span
                style={timestamp}
                data-testid="rsc-renderable-bar-timestamp"
              >
                Rendered: {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>
            <div data-testid="rsc-nested-renderable-bar-content">
              I am foo.bar
            </div>
          </div>
        ),
      },
      baz: (
        <div style={serverBox} data-testid="rsc-nested-renderable-baz">
          <div style={serverHeader}>
            <span style={serverBadge}>SERVER RENDERABLE BAZ</span>
          </div>
          <div data-testid="rsc-nested-renderable-baz-content">I am baz</div>
        </div>
      ),
    }

    const rendered = await renderServerComponent(serverNode)

    return rendered
  },
)

const getDestructuredComponents = createServerFn({ method: 'GET' }).handler(
  async () => {
    const serverTimestamp = Date.now()

    return createCompositeComponent(
      (props: {
        children?: React.ReactNode
        renderBadge?: (data: { count: number }) => React.ReactNode
      }) => ({
        Header: (
          <div style={serverBox} data-testid="rsc-destructured-header">
            <div style={serverHeader}>
              <span style={serverBadge}>DESTRUCTURED HEADER</span>
              <span style={timestamp} data-testid="rsc-destructured-timestamp">
                Rendered: {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>
            <h3 style={{ margin: '8px 0 0 0', color: '#0c4a6e' }}>
              Destructured Access Pattern
            </h3>
            {props.children}
          </div>
        ),

        Content: (
          <div style={serverBox} data-testid="rsc-destructured-content">
            <div style={serverHeader}>
              <span style={serverBadge}>DESTRUCTURED CONTENT</span>
            </div>
            <p style={{ margin: '12px 0 0 0', color: '#0369a1' }}>
              This component was destructured from loader data
            </p>
            {props.renderBadge?.({ count: 42 })}
          </div>
        ),

        Footer: (
          <div style={serverBox} data-testid="rsc-destructured-footer">
            <div style={serverHeader}>
              <span style={serverBadge}>DESTRUCTURED FOOTER</span>
            </div>
            <p
              style={{
                margin: '12px 0 0 0',
                fontSize: '12px',
                color: '#64748b',
              }}
            >
              Destructured components work exactly like dot-notation access
            </p>
            {props.children}
          </div>
        ),
      }),
    )
  },
)

export const Route = createFileRoute('/rsc-nested-structure')({
  loader: async () => {
    const [NestedComponents, DestructuredLayout, NestedRenderableParts] =
      await Promise.all([
        getNestedServerComponents({
          data: { title: 'Dashboard Overview' },
        }),
        getDestructuredComponents(),
        getNestedRenderableParts(),
      ])

    return {
      NestedComponents,
      DestructuredLayout,
      NestedRenderableParts,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscNestedStructureComponent,
})

function RscNestedStructureComponent() {
  const {
    NestedComponents,
    DestructuredLayout,
    NestedRenderableParts,
    loaderTimestamp,
  } = Route.useLoaderData()

  // Destructure nested components from loader data
  const { Header, Content, Footer } = DestructuredLayout

  const [headerSlotText, setHeaderSlotText] = React.useState(
    'Initial header slot',
  )
  const [statsMultiplier, setStatsMultiplier] = React.useState(1)
  const [infoSlotVisible, setInfoSlotVisible] = React.useState(true)
  const [footerSlotText, setFooterSlotText] = React.useState(
    'Initial footer slot',
  )
  const [destructuredSlotText, setDestructuredSlotText] = React.useState(
    'Initial destructured slot',
  )
  const [badgeMultiplier, setBadgeMultiplier] = React.useState(1)

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-nested-structure-title" style={pageStyles.title}>
        Nested RSC Structure with Slots
      </h1>

      <div style={{ marginBottom: '20px' }}>
        <h2
          style={{ fontSize: '16px', marginBottom: '12px', color: '#374151' }}
        >
          Nested Structure Renderables
        </h2>
        <p style={pageStyles.description}>
          These are returned via <code>renderServerComponent</code> in a nested
          object and rendered via dot access: <code>data.foo.bar</code>.
        </p>

        <div style={{ marginBottom: '16px' }}>
          {NestedRenderableParts.foo.bar}
        </div>
        <div>{NestedRenderableParts.baz}</div>
      </div>
      <p style={pageStyles.description}>
        This example demonstrates returning an object structure with multiple
        ReactNodes from a single server component. Each nested component
        supports slots (children and render props) for client interactivity.
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
          Use these buttons to modify slot content. Server components won't
          reload!
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            data-testid="update-header-slot-btn"
            onClick={() =>
              setHeaderSlotText(`Header updated at ${formatTime(Date.now())}`)
            }
            style={{ ...clientStyles.button, ...clientStyles.primaryButton }}
          >
            Update Header Slot
          </button>
          <button
            data-testid="increase-stats-btn"
            onClick={() => setStatsMultiplier((m) => m + 1)}
            style={{ ...clientStyles.button, ...clientStyles.secondaryButton }}
          >
            Increase Multiplier (x{statsMultiplier})
          </button>
          <button
            data-testid="toggle-info-slot-btn"
            onClick={() => setInfoSlotVisible((v) => !v)}
            style={{ ...clientStyles.button, ...clientStyles.secondaryButton }}
          >
            {infoSlotVisible ? 'Hide' : 'Show'} Info Slot
          </button>
          <button
            data-testid="update-footer-slot-btn"
            onClick={() =>
              setFooterSlotText(`Footer updated at ${formatTime(Date.now())}`)
            }
            style={{ ...clientStyles.button, ...clientStyles.secondaryButton }}
          >
            Update Footer Slot
          </button>
        </div>
      </div>

      {/* Nested structure rendering with slots */}
      <div style={{ marginBottom: '20px' }}>
        <h2
          style={{ fontSize: '16px', marginBottom: '12px', color: '#374151' }}
        >
          Nested Structure Components with Slots
        </h2>

        {/* Top-level access with children slot */}
        <div style={{ marginBottom: '16px' }}>
          <CompositeComponent src={NestedComponents.Header}>
            <div
              style={{
                marginTop: '12px',
                padding: '8px',
                backgroundColor: '#dcfce7',
                border: '1px solid #16a34a',
                borderRadius: '4px',
                color: '#166534',
              }}
              data-testid="header-slot-content"
            >
              <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                CLIENT SLOT:
              </span>{' '}
              {headerSlotText}
            </div>
          </CompositeComponent>
        </div>

        {/* Nested access with render prop slot */}
        <div style={{ marginBottom: '16px' }}>
          <CompositeComponent
            src={NestedComponents.content.Stats}
            renderExtra={({ total }: { total: number }) => (
              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid #bae6fd',
                  padding: '8px',
                  backgroundColor: '#dcfce7',
                  border: '1px solid #16a34a',
                  borderRadius: '4px',
                  color: '#166534',
                }}
                data-testid="stats-slot-content"
              >
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                  CLIENT RENDER PROP:
                </span>{' '}
                Server total: {total} × {statsMultiplier} ={' '}
                <strong data-testid="stats-computed-value">
                  {total * statsMultiplier}
                </strong>
              </div>
            )}
          />
        </div>

        {/* Deep nested access with children slot */}
        <div style={{ marginBottom: '16px' }}>
          <CompositeComponent src={NestedComponents.content.details.Info}>
            {infoSlotVisible && (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: '#dcfce7',
                  border: '1px solid #16a34a',
                  borderRadius: '4px',
                  color: '#166534',
                }}
                data-testid="info-slot-content"
              >
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                  CLIENT SLOT:
                </span>{' '}
                Deeply nested client content
              </div>
            )}
          </CompositeComponent>
        </div>

        {/* Footer with both children and render prop slots */}
        <div>
          <CompositeComponent
            src={NestedComponents.Footer}
            renderActions={({ version }: { version: string }) => (
              <div
                style={{
                  marginTop: '12px',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                }}
                data-testid="footer-actions-content"
              >
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  Version from server:{' '}
                  <strong data-testid="footer-version-value">{version}</strong>
                </span>
                <button
                  style={{
                    padding: '4px 12px',
                    backgroundColor: '#16a34a',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '12px',
                  }}
                  data-testid="footer-action-btn"
                  onClick={() => alert(`Action for version ${version}`)}
                >
                  Action
                </button>
              </div>
            )}
          >
            <div
              style={{
                marginTop: '12px',
                padding: '8px',
                backgroundColor: '#dcfce7',
                border: '1px solid #16a34a',
                borderRadius: '4px',
                color: '#166534',
              }}
              data-testid="footer-slot-content"
            >
              <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                CLIENT SLOT:
              </span>{' '}
              {footerSlotText}
            </div>
          </CompositeComponent>
        </div>
      </div>

      {/* ================================================================== */}
      {/* DESTRUCTURED ACCESS PATTERN */}
      {/* ================================================================== */}
      <div style={{ marginBottom: '20px' }}>
        <h2
          style={{ fontSize: '16px', marginBottom: '12px', color: '#374151' }}
        >
          Destructured Access Pattern
        </h2>
        <p
          style={{
            fontSize: '13px',
            color: '#64748b',
            marginBottom: '16px',
          }}
        >
          These components are destructured from loader data:{' '}
          <code>
            {'const { Header, Content, Footer } = DestructuredLayout'}
          </code>
        </p>

        {/* Controls for destructured section */}
        <div style={{ ...clientStyles.container, marginBottom: '16px' }}>
          <div style={clientStyles.header}>
            <span style={clientStyles.badge}>DESTRUCTURED CONTROLS</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              data-testid="update-destructured-slot-btn"
              onClick={() =>
                setDestructuredSlotText(
                  `Destructured updated at ${formatTime(Date.now())}`,
                )
              }
              style={{ ...clientStyles.button, ...clientStyles.primaryButton }}
            >
              Update Destructured Slot
            </button>
            <button
              data-testid="increase-badge-btn"
              onClick={() => setBadgeMultiplier((m) => m + 1)}
              style={{
                ...clientStyles.button,
                ...clientStyles.secondaryButton,
              }}
            >
              Increase Badge (x{badgeMultiplier})
            </button>
          </div>
        </div>

        {/* Destructured Header with children slot */}
        <div style={{ marginBottom: '16px' }}>
          <CompositeComponent src={Header}>
            <div
              style={{
                marginTop: '12px',
                padding: '8px',
                backgroundColor: '#dcfce7',
                border: '1px solid #16a34a',
                borderRadius: '4px',
                color: '#166534',
              }}
              data-testid="destructured-header-slot"
            >
              <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                CLIENT SLOT:
              </span>{' '}
              {destructuredSlotText}
            </div>
          </CompositeComponent>
        </div>

        {/* Destructured Content with render prop */}
        <div style={{ marginBottom: '16px' }}>
          <CompositeComponent
            src={Content}
            renderBadge={({ count }: { count: number }) => (
              <div
                style={{
                  marginTop: '12px',
                  padding: '8px',
                  backgroundColor: '#dcfce7',
                  border: '1px solid #16a34a',
                  borderRadius: '4px',
                  color: '#166534',
                }}
                data-testid="destructured-content-slot"
              >
                <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                  CLIENT RENDER PROP:
                </span>{' '}
                Server count: {count} × {badgeMultiplier} ={' '}
                <strong data-testid="destructured-computed-value">
                  {count * badgeMultiplier}
                </strong>
              </div>
            )}
          />
        </div>

        {/* Destructured Footer with children slot */}
        <div>
          <CompositeComponent src={Footer}>
            <div
              style={{
                marginTop: '12px',
                padding: '8px',
                backgroundColor: '#dcfce7',
                border: '1px solid #16a34a',
                borderRadius: '4px',
                color: '#166534',
              }}
              data-testid="destructured-footer-slot"
            >
              <span style={{ fontSize: '11px', fontWeight: 'bold' }}>
                CLIENT SLOT:
              </span>{' '}
              Footer via destructuring
            </div>
          </CompositeComponent>
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
          <li>
            Single server function returns multiple RSC components in a
            structure
          </li>
          <li>
            Access nested components via dot notation:{' '}
            <code>result.content.Stats</code>
          </li>
          <li>
            Or destructure from loader data:{' '}
            <code>{'const { Header, Content, Footer } = Layout'}</code>
          </li>
          <li>
            Deep nesting supported: <code>result.content.details.Info</code>
          </li>
          <li>
            Each nested component supports flat slots (children, render props)
          </li>
          <li>
            Render props receive server data:{' '}
            <code>{'renderExtra={({ total }) => ...}'}</code>
          </li>
          <li>Slot updates do NOT refetch server components</li>
        </ul>
      </div>
    </div>
  )
}
