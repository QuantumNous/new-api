import { createFileRoute } from '@tanstack/react-router'
import { getBasicServerComponent } from '~/utils/basicServerComponent'
import { formatTime, pageStyles } from '~/utils/styles'

export const Route = createFileRoute('/rsc-basic')({
  loader: async () => {
    const Server = await getBasicServerComponent({
      data: { label: 'test label' },
    })
    return {
      Server,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscBasicComponent,
  pendingComponent: () => {
    console.log('[PENDING] /rsc-basic')
    return <>Loading...</>
  },
})

function RscBasicComponent() {
  const { Server, loaderTimestamp } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-basic-title" style={pageStyles.title}>
        User Profile Card
      </h1>
      <p style={pageStyles.description}>
        This example shows a simple RSC with no client interaction. The user
        profile is fetched and rendered entirely on the server. Notice the
        server timestamp - it won't change unless you refresh the page.
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
          <li>All content is server-rendered (blue box)</li>
          <li>No client JavaScript needed for this component</li>
          <li>Data is fetched once in the loader and cached</li>
          <li>Navigate away and back - the timestamp stays the same</li>
        </ul>
      </div>
    </div>
  )
}
