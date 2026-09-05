import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/relative/useNavigate/path/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div class="p-2">
      <div class="border-b" data-testid="relative-useNavigate-path-header">
        Relative Routing Tests - Path Params
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
