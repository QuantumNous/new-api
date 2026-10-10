import { createFileRoute, useMatches } from '@tanstack/react-router'

export const Route = createFileRoute('/fullpath-test/_layout/')({
  component: IndexComponent,
})

function IndexComponent() {
  const matches = useMatches()
  // Find this index route's match by routeId
  const indexMatch = matches.find(
    (m) => m.routeId === '/fullpath-test/_layout/',
  )

  return (
    <div>
      <div data-testid="index-route-fullpath">
        {indexMatch?.fullPath ?? 'undefined'}
      </div>
      <div data-testid="index-route-to">{Route.to}</div>
      <div data-testid="fullpath-test-index">FullPath Test Index</div>
    </div>
  )
}
