import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/suffix/{$baz}suffix')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-suffix-baz-route-heading">
        Hello non-nested suffix route layout
      </div>
      <Outlet />
    </div>
  )
}
