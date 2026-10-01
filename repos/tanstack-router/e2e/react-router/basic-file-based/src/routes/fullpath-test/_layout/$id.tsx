import { createFileRoute, useMatches } from '@tanstack/react-router'

export const Route = createFileRoute('/fullpath-test/_layout/$id')({
  component: IdComponent,
})

function IdComponent() {
  const matches = useMatches()
  const { id } = Route.useParams()
  // Find this route's match by routeId
  const idMatch = matches.find(
    (m) => m.routeId === '/fullpath-test/_layout/$id',
  )

  return (
    <div>
      <div data-testid="param-route-fullpath">
        {idMatch?.fullPath ?? 'undefined'}
      </div>
      <div data-testid="fullpath-test-param">Param: {id}</div>
    </div>
  )
}
