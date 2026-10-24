import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/deep/$baz')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-deep-baz-route-heading">
        Hello non-nested named baz route layout
      </div>
      <Outlet />
    </div>
  )
}
