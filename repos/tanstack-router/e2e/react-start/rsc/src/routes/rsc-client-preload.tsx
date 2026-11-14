import { createFileRoute } from '@tanstack/react-router'
import { formatTime, pageStyles } from '~/utils/styles'
import { getClientPreloadServerComponent } from '~/utils/clientPreloadServerComponent'

// ============================================================================
// CLIENT PRELOAD TEST: Server component with "use client" component
// Tests that client component JS and CSS are preloaded in <head>
// ============================================================================

export const Route = createFileRoute('/rsc-client-preload')({
  loader: async () => {
    const Server = await getClientPreloadServerComponent({
      data: { title: 'Client Component Preload Test' },
    })
    return {
      Server,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscClientPreloadComponent,
  pendingComponent: () => {
    console.log('[PENDING] /rsc-client-preload')
    return <>Loading...</>
  },
})

function RscClientPreloadComponent() {
  const { Server, loaderTimestamp } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-client-preload-page-title" style={pageStyles.title}>
        Client Component Preload Test
      </h1>
      <p style={pageStyles.description}>
        This page tests that when a server component contains a client component
        with CSS modules, both the JS and CSS are preloaded in the document head
        to prevent flash of unstyled content.
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
        <strong>Expected Behavior:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>
            Client component JS should have{' '}
            <code>&lt;link rel="modulepreload"&gt;</code> in head
          </li>
          <li>
            Client component CSS should have{' '}
            <code>&lt;link rel="preload" as="style"&gt;</code> in head
          </li>
          <li>No flash of unstyled content on initial load</li>
          <li>Counter should be interactive after hydration</li>
        </ul>
      </div>
    </div>
  )
}
