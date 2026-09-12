import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/relative/link/path/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="p-2">
      <div className="border-b" data-testid="relative-link-path-header">
        Relative Routing Tests - Path Params
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
