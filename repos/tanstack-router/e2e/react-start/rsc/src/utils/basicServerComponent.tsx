import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { serverBox, serverBadge, serverHeader, timestamp } from './serverStyles'

// ============================================================================
// BASIC: User Profile Card
// Used by: rsc-basic.tsx, rsc-hydration.tsx
// ============================================================================

export const getBasicServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { label?: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Simulate fetching user from database
    const user = {
      id: 'usr_' + Math.random().toString(36).slice(2, 8),
      name: 'Sarah Chen',
      role: 'Senior Software Engineer',
      department: 'Platform Team',
      email: 'sarah.chen@example.com',
      joinDate: 'March 2021',
      projects: 12,
      contributions: 847,
    }

    return renderServerComponent(
      <div style={serverBox} data-testid="rsc-basic-content">
        <div style={serverHeader}>
          <span style={serverBadge} data-testid="rsc-server-badge">
            SERVER RENDERED
          </span>
          <span style={timestamp} data-testid="rsc-server-timestamp">
            Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>

        {/* Profile Header */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#0284c7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '24px',
              fontWeight: 'bold',
            }}
          >
            SC
          </div>
          <div>
            <h2
              style={{ margin: '0 0 4px 0', color: '#0c4a6e' }}
              data-testid="rsc-label"
            >
              {user.name}
            </h2>
            <div style={{ color: '#0369a1' }}>{user.role}</div>
            <div style={{ color: '#64748b', fontSize: '14px' }}>
              {user.department}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            padding: '12px',
            backgroundColor: '#f0f9ff',
            borderRadius: '6px',
            textAlign: 'center',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#0284c7',
              }}
            >
              {user.projects}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Projects</div>
          </div>
          <div>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#0284c7',
              }}
            >
              {user.contributions}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>
              Contributions
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#0284c7',
              }}
            >
              {user.joinDate.split(' ')[1]}
            </div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Since</div>
          </div>
        </div>

        <div style={{ marginTop: '12px', fontSize: '13px', color: '#64748b' }}>
          User ID: {user.id}
        </div>
      </div>,
    )
  })
