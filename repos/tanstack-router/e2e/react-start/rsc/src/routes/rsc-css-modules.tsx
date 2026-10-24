import { createFileRoute } from '@tanstack/react-router'
import { getCssModulesServerComponent } from '~/utils/cssModulesServerComponent'
import { formatTime, pageStyles } from '~/utils/styles'

export const Route = createFileRoute('/rsc-css-modules')({
  loader: async () => {
    const Server = await getCssModulesServerComponent({
      data: { title: 'CSS Modules in Server Components' },
    })
    return {
      Server,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscCssModulesComponent,
  pendingComponent: () => {
    console.log('[PENDING] /rsc-css-modules')
    return <>Loading...</>
  },
})

function RscCssModulesComponent() {
  const { Server, loaderTimestamp } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-css-modules-page-title" style={pageStyles.title}>
        CSS Modules in RSC
      </h1>
      <p style={pageStyles.description}>
        This example demonstrates using CSS Modules (`.module.css` files) within
        server components. The styles are scoped, extracted, and work seamlessly
        with RSC.
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
          <li>CSS Modules work in server components</li>
          <li>Class names are automatically scoped (hashed)</li>
          <li>Styles are extracted and sent to the client</li>
          <li>No style conflicts with other components</li>
        </ul>
      </div>
    </div>
  )
}
