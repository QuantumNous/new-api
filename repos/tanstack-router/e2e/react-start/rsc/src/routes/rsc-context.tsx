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

const getContextAwareServerComponent = createServerFn({
  method: 'GET',
})
  .validator((data: { userId: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    // Simulate fetching user preferences from server
    const userPrefs = {
      theme: 'light',
      language: 'en',
      notifications: true,
    }

    return renderServerComponent(
      <div style={serverBox} data-testid="rsc-context-content">
        <div style={serverHeader}>
          <span style={serverBadge}>SERVER COMPONENT</span>
          <span style={timestamp} data-testid="rsc-context-timestamp">
            {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>

        <h3 style={{ margin: '0 0 12px 0', color: '#0c4a6e' }}>
          Server-Fetched User Data
        </h3>

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
              color: '#0369a1',
              fontWeight: 'bold',
              marginBottom: '8px',
            }}
          >
            USER PREFERENCES FROM SERVER
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div>
              User ID:{' '}
              <strong data-testid="server-user-id">{data.userId}</strong>
            </div>
            <div>
              Saved Theme:{' '}
              <strong data-testid="server-theme">{userPrefs.theme}</strong>
            </div>
            <div>
              Language:{' '}
              <strong data-testid="server-language">
                {userPrefs.language}
              </strong>
            </div>
            <div>
              Notifications:{' '}
              <strong data-testid="server-notifications">
                {userPrefs.notifications ? 'ON' : 'OFF'}
              </strong>
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: '12px',
            fontSize: '12px',
            color: '#64748b',
          }}
        >
          This data was fetched from the server. The client context (below)
          shows local client-side state.
        </div>
      </div>,
    )
  })

// Client-side theme context
const ThemeContext = React.createContext<{
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}>({
  theme: 'light',
  setTheme: () => {},
})

export const Route = createFileRoute('/rsc-context')({
  loader: async () => {
    const ContextAware = await getContextAwareServerComponent({
      data: { userId: 'user_12345' },
    })
    return {
      ContextAware,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscContextComponent,
})

function RscContextComponent() {
  const { ContextAware, loaderTimestamp } = Route.useLoaderData()
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light')
  const [notifications, setNotifications] = React.useState(true)

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div
        style={{
          ...pageStyles.container,
          backgroundColor: theme === 'dark' ? '#1e293b' : 'white',
          color: theme === 'dark' ? '#e2e8f0' : 'inherit',
          minHeight: '100vh',
          transition: 'all 0.3s',
        }}
      >
        <h1
          data-testid="rsc-context-title"
          style={{
            ...pageStyles.title,
            color: theme === 'dark' ? '#f1f5f9' : pageStyles.title.color,
          }}
        >
          User Preferences - RSC with Context
        </h1>
        <p
          style={{
            ...pageStyles.description,
            color: theme === 'dark' ? '#94a3b8' : pageStyles.description.color,
          }}
        >
          This example tests RSC interaction with React Context. The RSC fetches
          user preferences from the server, then displays them alongside client
          components that can consume and modify context.
        </p>

        <div
          style={{
            fontSize: '12px',
            color: theme === 'dark' ? '#64748b' : '#64748b',
            marginBottom: '16px',
          }}
        >
          <span data-testid="loader-timestamp" style={{ display: 'none' }}>
            {loaderTimestamp}
          </span>
          Route loaded at: {formatTime(loaderTimestamp)}
        </div>

        {/* Theme Controls */}
        <div
          style={{
            ...clientStyles.container,
            backgroundColor:
              theme === 'dark'
                ? '#166534'
                : clientStyles.container.backgroundColor,
          }}
          data-testid="context-controls"
        >
          <div style={clientStyles.header}>
            <span style={clientStyles.badge}>CLIENT CONTEXT</span>
            <span
              style={{
                fontSize: '12px',
                color: theme === 'dark' ? '#bbf7d0' : '#166534',
              }}
              data-testid="current-theme"
            >
              Theme: {theme}
            </span>
          </div>

          <p
            style={{
              margin: '0 0 12px 0',
              fontSize: '13px',
              color: theme === 'dark' ? '#bbf7d0' : '#166534',
            }}
          >
            These controls modify React Context. The RSC below renders server
            data, while the context consumer below shows client state.
          </p>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              data-testid="toggle-theme-btn"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              style={{ ...clientStyles.button, ...clientStyles.primaryButton }}
            >
              Toggle Theme
            </button>
            <button
              data-testid="toggle-notifications-btn"
              onClick={() => setNotifications(!notifications)}
              style={{
                ...clientStyles.button,
                ...clientStyles.secondaryButton,
              }}
            >
              Notifications: {notifications ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Server Component - displays server data */}
        {ContextAware}

        {/* Client Component - consumes context */}
        <ContextConsumer notifications={notifications} />

        <div
          style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: theme === 'dark' ? '#334155' : '#f8fafc',
            borderRadius: '8px',
            fontSize: '13px',
            color: theme === 'dark' ? '#94a3b8' : '#64748b',
          }}
        >
          <strong>Key Points:</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
            <li>RSC fetches data from server (user preferences)</li>
            <li>Client components can consume React Context</li>
            <li>Theme changes via context don't refetch RSC</li>
            <li>Server and client data are displayed separately</li>
          </ul>
        </div>
      </div>
    </ThemeContext.Provider>
  )
}

// Client component that consumes context
function ContextConsumer({ notifications }: { notifications: boolean }) {
  const { theme } = React.useContext(ThemeContext)

  return (
    <div
      style={{
        padding: '16px',
        backgroundColor: theme === 'dark' ? '#166534' : '#dcfce7',
        border: `2px solid ${theme === 'dark' ? '#22c55e' : '#16a34a'}`,
        borderRadius: '8px',
        marginTop: '12px',
      }}
      data-testid="context-consumer"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '12px',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            backgroundColor: '#16a34a',
            color: 'white',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: 'bold',
          }}
        >
          CLIENT COMPONENT
        </span>
        <span
          style={{
            fontSize: '12px',
            color: theme === 'dark' ? '#bbf7d0' : '#166534',
          }}
        >
          Consuming Context
        </span>
      </div>

      <div
        style={{
          padding: '12px',
          backgroundColor: theme === 'dark' ? '#14532d' : 'white',
          borderRadius: '6px',
        }}
      >
        <div
          style={{
            fontSize: '11px',
            color: '#64748b',
            marginBottom: '4px',
          }}
        >
          From Client Context
        </div>
        <div style={{ color: theme === 'dark' ? '#bbf7d0' : '#166534' }}>
          <div>
            Current Theme: <strong data-testid="client-theme">{theme}</strong>
          </div>
          <div>
            Local Notifications:{' '}
            <strong data-testid="client-notifications">
              {notifications ? 'ON' : 'OFF'}
            </strong>
          </div>
        </div>
      </div>
    </div>
  )
}
