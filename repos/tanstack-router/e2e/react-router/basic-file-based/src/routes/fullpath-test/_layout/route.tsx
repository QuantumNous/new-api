import { Outlet, createFileRoute, useMatches } from '@tanstack/react-router'

export const Route = createFileRoute('/fullpath-test/_layout')({
  component: LayoutComponent,
})

function LayoutComponent() {
  const matches = useMatches()
  // Find this layout's match by routeId
  const layoutMatch = matches.find(
    (m) => m.routeId === '/fullpath-test/_layout',
  )

  return (
    <div>
      <div data-testid="pathless-layout-fullpath">
        {layoutMatch?.fullPath ?? 'undefined'}
      </div>
      <Outlet />
    </div>
  )
}
