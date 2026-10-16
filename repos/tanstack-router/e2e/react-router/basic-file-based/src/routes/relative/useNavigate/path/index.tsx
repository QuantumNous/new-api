import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/relative/useNavigate/path/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="p-2">
      <div className="border-b" data-testid="relative-useNavigate-path-header">
        Relative Routing Tests - Path Params
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
