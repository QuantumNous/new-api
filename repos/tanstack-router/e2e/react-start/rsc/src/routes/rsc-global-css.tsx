import { createFileRoute } from '@tanstack/react-router'
import { getGlobalCssServerComponent } from '~/utils/globalCssServerComponent'
import { formatTime, pageStyles } from '~/utils/styles'
// Import global CSS to ensure styles are included in the client bundle
import '~/utils/serverComponent.css'

export const Route = createFileRoute('/rsc-global-css')({
  loader: async () => {
    const Server = await getGlobalCssServerComponent({
      data: { title: 'Global CSS in Server Components' },
    })
    return {
      Server,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscGlobalCssComponent,
  pendingComponent: () => {
    console.log('[PENDING] /rsc-global-css')
    return <>Loading...</>
  },
})

function RscGlobalCssComponent() {
  const { Server, loaderTimestamp } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-global-css-page-title" style={pageStyles.title}>
        Global CSS in RSC
      </h1>
      <p style={pageStyles.description}>
        This example demonstrates using global CSS (`import 'styles.css'`)
        within server components. Unlike CSS Modules, class names are not
        scoped.
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
          <li>Global CSS works in server components</li>
          <li>Class names are NOT scoped (plain strings)</li>
          <li>Styles are extracted and sent to the client</li>
          <li>Use naming conventions to avoid conflicts</li>
        </ul>
      </div>
    </div>
  )
}
