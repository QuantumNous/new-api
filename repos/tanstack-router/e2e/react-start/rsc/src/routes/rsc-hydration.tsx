import * as React from 'react'
import { ClientOnly, createFileRoute } from '@tanstack/react-router'
import { getBasicServerComponent } from '~/utils/basicServerComponent'
import { pageStyles, clientStyles, formatTime } from '~/utils/styles'

export const Route = createFileRoute('/rsc-hydration')({
  loader: async () => {
    const Server = await getBasicServerComponent({
      data: { label: 'hydration test' },
    })
    return {
      Server,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscHydrationComponent,
})

function RscHydrationComponent() {
  const { Server, loaderTimestamp } = Route.useLoaderData()
  const [hydrationStatus, setHydrationStatus] = React.useState<
    'checking' | 'success' | 'mismatch'
  >('checking')
  const [consoleErrors, setConsoleErrors] = React.useState<string[]>([])
  const [clientTimestamp] = React.useState(Date.now())

  React.useEffect(() => {
    // Check for hydration errors in console
    const originalError = console.error
    const errors: string[] = []

    console.error = (...args) => {
      const message = args.map((a) => String(a)).join(' ')
      if (
        message.includes('hydrat') ||
        message.includes('mismatch') ||
        message.includes('did not match')
      ) {
        errors.push(message)
      }
      originalError.apply(console, args)
    }

    // Give React time to report hydration issues
    const timeout = setTimeout(() => {
      setConsoleErrors(errors)
      setHydrationStatus(errors.length > 0 ? 'mismatch' : 'success')
    }, 1000)

    return () => {
      console.error = originalError
      clearTimeout(timeout)
    }
  }, [])

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-hydration-title" style={pageStyles.title}>
        User Profile - RSC Hydration Test
      </h1>
      <p style={pageStyles.description}>
        This example tests that RSC content hydrates correctly without
        mismatches. The page monitors for React hydration warnings and displays
        the result. A successful hydration means server and client content
        matched perfectly.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {/* Hydration Status */}
      <div
        style={{
          padding: '16px',
          backgroundColor:
            hydrationStatus === 'success'
              ? '#f0fdf4'
              : hydrationStatus === 'mismatch'
                ? '#fef2f2'
                : '#fef3c7',
          border: `2px solid ${
            hydrationStatus === 'success'
              ? '#16a34a'
              : hydrationStatus === 'mismatch'
                ? '#dc2626'
                : '#f59e0b'
          }`,
          borderRadius: '8px',
          marginBottom: '16px',
        }}
        data-testid="hydration-status"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '12px',
          }}
        >
          <span style={{ fontSize: '32px' }}>
            {hydrationStatus === 'success'
              ? '✅'
              : hydrationStatus === 'mismatch'
                ? '❌'
                : '⏳'}
          </span>
          <div>
            <div
              style={{
                fontSize: '11px',
                color:
                  hydrationStatus === 'success'
                    ? '#16a34a'
                    : hydrationStatus === 'mismatch'
                      ? '#dc2626'
                      : '#f59e0b',
                fontWeight: 'bold',
                letterSpacing: '0.5px',
              }}
            >
              HYDRATION STATUS
            </div>
            <h2
              style={{
                margin: 0,
                color:
                  hydrationStatus === 'success'
                    ? '#166534'
                    : hydrationStatus === 'mismatch'
                      ? '#991b1b'
                      : '#92400e',
              }}
              data-testid="hydration-result"
            >
              {hydrationStatus === 'success'
                ? 'Hydration Successful'
                : hydrationStatus === 'mismatch'
                  ? 'Hydration Mismatch Detected'
                  : 'Checking Hydration...'}
            </h2>
          </div>
        </div>

        {hydrationStatus === 'success' && (
          <p
            style={{ margin: 0, color: '#166534', fontSize: '14px' }}
            data-testid="hydration-success-message"
          >
            The RSC content matched between server and client. No hydration
            warnings were detected in the console.
          </p>
        )}

        {hydrationStatus === 'mismatch' && (
          <div>
            <p
              style={{
                margin: '0 0 8px 0',
                color: '#991b1b',
                fontSize: '14px',
              }}
            >
              Hydration errors were detected:
            </p>
            <ul
              style={{
                margin: 0,
                paddingLeft: '20px',
                color: '#dc2626',
                fontSize: '12px',
              }}
            >
              {consoleErrors.map((err, i) => (
                <li key={i}>{err.slice(0, 200)}...</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ClientOnly>
        {/* Timing Info */}
        <div style={clientStyles.container} data-testid="timing-info">
          <div style={clientStyles.header}>
            <span style={clientStyles.badge}>TIMING INFO</span>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            <div
              style={{
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #bbf7d0',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Server Timestamp (Loader)
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#166534',
                  fontFamily: 'monospace',
                }}
                data-testid="server-time"
              >
                {loaderTimestamp}
              </div>
            </div>
            <div
              style={{
                padding: '12px',
                backgroundColor: 'white',
                borderRadius: '6px',
                border: '1px solid #bbf7d0',
              }}
            >
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Client Timestamp (useState)
              </div>
              <div
                style={{
                  fontSize: '14px',
                  color: '#166534',
                  fontFamily: 'monospace',
                }}
                data-testid="client-time"
              >
                {clientTimestamp}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748b' }}>
            Time difference:{' '}
            <strong data-testid="time-diff">
              {clientTimestamp - loaderTimestamp}ms
            </strong>{' '}
            (client - server)
          </div>
        </div>
      </ClientOnly>

      {/* RSC Content */}
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
          <li>Monitors console for React hydration warnings</li>
          <li>Success means server HTML matched client expectations</li>
          <li>RSC content should hydrate without mismatches</li>
          <li>Timing info shows server vs client timestamps</li>
        </ul>
      </div>
    </div>
  )
}
