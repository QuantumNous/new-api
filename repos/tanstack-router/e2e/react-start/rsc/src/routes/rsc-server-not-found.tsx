import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { pageStyles } from '~/utils/styles'

const getMissingResource = createServerFn({
  method: 'GET',
}).handler(async () => {
  throw notFound()
})

export const Route = createFileRoute('/rsc-server-not-found')({
  loader: async () => {
    await getMissingResource()
  },
  component: RscServerNotFoundComponent,
  notFoundComponent: RscServerNotFoundBoundary,
})

function RscServerNotFoundComponent() {
  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-server-not-found-title" style={pageStyles.title}>
        RSC Server Not Found
      </h1>
    </div>
  )
}

function RscServerNotFoundBoundary() {
  return (
    <div
      style={pageStyles.container}
      data-testid="rsc-server-not-found-boundary"
    >
      <h1 data-testid="rsc-server-not-found-heading" style={pageStyles.title}>
        RSC Server Function Not Found
      </h1>
      <p
        data-testid="rsc-server-not-found-message"
        style={pageStyles.description}
      >
        The server function threw `notFound()` and the route-level not found
        boundary rendered instead of crashing.
      </p>
      <Link to="/" data-testid="rsc-server-not-found-home-link">
        Back home
      </Link>
    </div>
  )
}
