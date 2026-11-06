import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import { pageStyles } from '~/utils/styles'
import {
  serverBadge,
  serverBox,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'

const getDirectLoaderServerComponent = createServerFn({
  method: 'GET',
}).handler(async () => {
  const serverTimestamp = Date.now()

  return renderServerComponent(
    <div style={serverBox} data-testid="rsc-direct-loader-content">
      <div style={serverHeader}>
        <span style={serverBadge}>SERVER RENDERED</span>
        <span style={timestamp} data-testid="rsc-direct-loader-timestamp">
          Fetched: {new Date(serverTimestamp).toLocaleTimeString()}
        </span>
      </div>

      <h2 data-testid="rsc-direct-loader-heading">Direct loader RSC</h2>
      <p>
        This route returns a server component directly from its loader without
        wrapping it in an object.
      </p>
    </div>,
  )
})

export const Route = createFileRoute('/rsc-direct-loader')({
  loader: () => getDirectLoaderServerComponent(),
  component: RscDirectLoaderComponent,
})

function RscDirectLoaderComponent() {
  const ServerComponent = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-direct-loader-title" style={pageStyles.title}>
        Direct Loader Return
      </h1>
      <p style={pageStyles.description}>
        The loader returns the server component itself. This guards against
        mistaking proxied loader data for a notFound result.
      </p>
      {ServerComponent}
    </div>
  )
}
