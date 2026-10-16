import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { pageStyles, formatTime } from '~/utils/styles'

// ============================================================================
// Server Component Definition
// ============================================================================

const getExternalDataServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { endpoint: string }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()
    const fetchStart = Date.now()

    // Fetch from the external mock server (set up in e2e tests)
    let externalData: { message: string; timestamp: number } | null = null
    let fetchError: string | null = null

    try {
      const response = await fetch(data.endpoint)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      externalData = await response.json()
    } catch (err) {
      fetchError = err instanceof Error ? err.message : 'Unknown error'
    }

    const fetchDuration = Date.now() - fetchStart

    return renderServerComponent(
      <div style={serverBox} data-testid="rsc-external-data">
        <div style={serverHeader}>
          <span style={serverBadge}>EXTERNAL API DATA</span>
          <span style={timestamp} data-testid="rsc-external-timestamp">
            {new Date(serverTimestamp).toLocaleTimeString()}
          </span>
        </div>

        {fetchError ? (
          <div
            style={{
              padding: '20px',
              backgroundColor: '#fef2f2',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              textAlign: 'center',
            }}
            data-testid="rsc-external-error"
          >
            <div style={{ fontSize: '24px', marginBottom: '8px' }}>❌</div>
            <div style={{ color: '#dc2626', fontWeight: 'bold' }}>
              Failed to fetch external data
            </div>
            <div style={{ color: '#64748b', fontSize: '13px' }}>
              {fetchError}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: '20px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                fontSize: '13px',
                color: '#64748b',
                marginBottom: '8px',
              }}
            >
              Response from external server:
            </div>
            <div
              style={{
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #bae6fd',
                fontFamily: 'monospace',
                fontSize: '13px',
              }}
              data-testid="rsc-external-response"
            >
              {JSON.stringify(externalData, null, 2)}
            </div>
            <div
              style={{
                marginTop: '12px',
                fontSize: '12px',
                color: '#64748b',
              }}
              data-testid="rsc-external-duration"
            >
              Fetched in {fetchDuration}ms from {data.endpoint}
            </div>
          </div>
        )}
      </div>,
    )
  })

// The external server URL is provided by the e2e test setup
const EXTERNAL_SERVER_URL =
  typeof process !== 'undefined' && process.env.EXTERNAL_SERVER_URL
    ? process.env.EXTERNAL_SERVER_URL
    : 'http://localhost:65003'

export const Route = createFileRoute('/rsc-external')({
  loader: async () => {
    const ExternalData = await getExternalDataServerComponent({
      data: { endpoint: `${EXTERNAL_SERVER_URL}/posts` },
    })
    return {
      ExternalData,
      loaderTimestamp: Date.now(),
      serverUrl: EXTERNAL_SERVER_URL,
    }
  },
  component: RscExternalComponent,
})

function RscExternalComponent() {
  const { ExternalData, loaderTimestamp, serverUrl } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-external-title" style={pageStyles.title}>
        Weather Data - RSC with External API
      </h1>
      <p style={pageStyles.description}>
        This example tests RSC fetching from an external API. The RSC makes a
        server-side fetch to a mock API server. This simulates real-world
        scenarios where RSCs need to call external services.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Server Info */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: '#f0f9ff',
          border: '1px solid #bae6fd',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '13px',
        }}
      >
        <div style={{ color: '#0369a1', marginBottom: '4px' }}>
          <strong>External Server:</strong>
        </div>
        <code
          style={{
            backgroundColor: '#e0f2fe',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
          data-testid="external-server-url"
        >
          {serverUrl}
        </code>
      </div>

      {/* External Data RSC */}
      {ExternalData}

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
          <li>RSC makes server-side fetch to external API</li>
          <li>External fetch happens during RSC render on server</li>
          <li>Response is embedded in the RSC payload</li>
          <li>Error handling for failed external requests</li>
          <li>Fetch duration is measured and displayed</li>
        </ul>
      </div>
    </div>
  )
}
