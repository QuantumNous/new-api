import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/relative/link/path/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div class="p-2">
      <div class="border-b" data-testid="relative-link-path-header">
        Relative Routing Tests - Path Params
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  )
}
