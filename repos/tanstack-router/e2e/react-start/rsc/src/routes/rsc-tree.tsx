import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import {
  CompositeComponent,
  createCompositeComponent,
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

const getTreeServerComponent = createServerFn({ method: 'GET' }).handler(
  async () => {
    const serverTimestamp = Date.now()
    const instanceId = Math.random().toString(36).slice(2, 8)

    const comment = {
      author: 'Alex Thompson',
      avatar: 'AT',
      time: '2 hours ago',
      content:
        'This is a great example of how RSC can be restructured in the DOM without losing its identity. The server timestamp stays the same even when moved!',
      likes: 24,
    }

    return createCompositeComponent(
      (props: { renderPosition?: () => React.ReactNode }) => {
        return (
          <div style={serverBox} data-testid="rsc-tree-content">
            <div style={serverHeader}>
              <span style={serverBadge}>SERVER COMMENT</span>
              <span style={timestamp} data-testid="rsc-tree-timestamp">
                {new Date(serverTimestamp).toLocaleTimeString()}
              </span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#0284c7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  flexShrink: 0,
                }}
              >
                {comment.avatar}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'baseline',
                    marginBottom: '4px',
                  }}
                >
                  <span style={{ fontWeight: 'bold', color: '#0c4a6e' }}>
                    {comment.author}
                  </span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {comment.time}
                  </span>
                </div>
                <p
                  style={{
                    margin: '0 0 8px 0',
                    color: '#334155',
                    lineHeight: '1.5',
                  }}
                >
                  {comment.content}
                </p>
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '13px',
                    color: '#64748b',
                  }}
                >
                  <span>♥ {comment.likes} likes</span>
                  <span data-testid="rsc-tree-instance-id">
                    ID: {instanceId}
                  </span>
                </div>
              </div>
            </div>

            {/* Position indicator from client */}
            <div
              style={{
                marginTop: '12px',
                padding: '8px',
                backgroundColor: '#f0f9ff',
                borderRadius: '4px',
                fontSize: '12px',
              }}
              data-testid="rsc-tree-position"
            >
              Current position: {props.renderPosition?.()}
            </div>
          </div>
        )
      },
    )
  },
)

export const Route = createFileRoute('/rsc-tree')({
  loader: async () => {
    const Server = await getTreeServerComponent()
    return {
      Server,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscTreeComponent,
  pendingComponent: () => {
    console.log('[PENDING] /rsc-tree')
    return <>Loading...</>
  },
})

function RscTreeComponent() {
  const { Server, loaderTimestamp } = Route.useLoaderData()
  const [parentType, setParentType] = React.useState<
    'div' | 'section' | 'article'
  >('div')
  const [wrapperCount, setWrapperCount] = React.useState(0)
  const [position, setPosition] = React.useState<'top' | 'bottom'>('top')

  // Wrap the RSC in different numbers of divs
  const wrapRsc = (rsc: React.ReactNode, count: number): React.ReactNode => {
    if (count <= 0) return rsc
    return (
      <div
        data-testid={`wrapper-${count}`}
        style={{
          padding: '8px',
          border: '2px dashed #94a3b8',
          borderRadius: '6px',
          margin: '8px',
          backgroundColor: `rgba(148, 163, 184, ${0.05 * count})`,
        }}
      >
        <div
          style={{ fontSize: '10px', color: '#64748b', marginBottom: '4px' }}
        >
          Wrapper Level {count}
        </div>
        {wrapRsc(rsc, count - 1)}
      </div>
    )
  }

  const Parent = parentType

  const serverComponent = (
    <CompositeComponent
      src={Server}
      renderPosition={() => (
        <span
          style={{
            padding: '2px 8px',
            backgroundColor: '#dcfce7',
            border: '1px solid #16a34a',
            borderRadius: '4px',
            color: '#166534',
            fontWeight: 'bold',
            fontSize: '12px',
          }}
        >
          {`<${parentType}> with ${wrapperCount} wrapper(s) at ${position}`}
        </span>
      )}
    />
  )

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-tree-title" style={pageStyles.title}>
        Comment Thread - Tree Restructuring
      </h1>
      <p style={pageStyles.description}>
        This RSC can be moved around the DOM tree without losing its identity.
        Change the parent element, add wrapper divs, or move it - the server
        timestamp and instance ID stay the same!
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

        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '12px',
              color: '#166534',
              marginBottom: '8px',
              fontWeight: 'bold',
            }}
          >
            Parent Element Type
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(['div', 'section', 'article'] as const).map((type) => (
              <button
                key={type}
                data-testid={`change-parent-${type}`}
                onClick={() => setParentType(type)}
                style={{
                  ...clientStyles.button,
                  ...(parentType === type
                    ? clientStyles.primaryButton
                    : clientStyles.secondaryButton),
                }}
              >
                &lt;{type}&gt;
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              fontSize: '12px',
              color: '#166534',
              marginBottom: '8px',
              fontWeight: 'bold',
            }}
          >
            Wrapper Depth: {wrapperCount}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              data-testid="add-wrapper"
              onClick={() => setWrapperCount((c) => Math.min(5, c + 1))}
              style={{ ...clientStyles.button, ...clientStyles.primaryButton }}
            >
              Add Wrapper
            </button>
            <button
              data-testid="remove-wrapper"
              onClick={() => setWrapperCount((c) => Math.max(0, c - 1))}
              style={{
                ...clientStyles.button,
                ...clientStyles.secondaryButton,
              }}
            >
              Remove Wrapper
            </button>
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: '12px',
              color: '#166534',
              marginBottom: '8px',
              fontWeight: 'bold',
            }}
          >
            Position
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setPosition('top')}
              style={{
                ...clientStyles.button,
                ...(position === 'top'
                  ? clientStyles.primaryButton
                  : clientStyles.secondaryButton),
              }}
            >
              Top
            </button>
            <button
              onClick={() => setPosition('bottom')}
              style={{
                ...clientStyles.button,
                ...(position === 'bottom'
                  ? clientStyles.primaryButton
                  : clientStyles.secondaryButton),
              }}
            >
              Bottom
            </button>
          </div>
        </div>

        {/* Hidden test elements */}
        <span data-testid="current-parent-type" style={{ display: 'none' }}>
          {parentType}
        </span>
        <span data-testid="current-wrapper-count" style={{ display: 'none' }}>
          {wrapperCount}
        </span>
      </div>

      {/* RSC Container */}
      <Parent
        data-testid="rsc-parent"
        style={{
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}
        >
          Current parent: <code>&lt;{parentType}&gt;</code>
        </div>

        {position === 'top' && wrapRsc(serverComponent, wrapperCount)}

        <div
          style={{
            padding: '12px',
            backgroundColor: '#fef3c7',
            borderRadius: '6px',
            margin: '12px 0',
            fontSize: '13px',
            color: '#92400e',
          }}
        >
          This is a client-rendered placeholder between positions. The RSC is
          currently at the <strong>{position}</strong>.
        </div>

        {position === 'bottom' && wrapRsc(serverComponent, wrapperCount)}
      </Parent>

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
          <li>RSC maintains its identity when moved in the DOM tree</li>
          <li>Changing parent elements doesn't refetch the component</li>
          <li>Adding/removing wrapper divs preserves the RSC instance</li>
          <li>Instance ID and timestamp remain constant through all changes</li>
        </ul>
      </div>
    </div>
  )
}
