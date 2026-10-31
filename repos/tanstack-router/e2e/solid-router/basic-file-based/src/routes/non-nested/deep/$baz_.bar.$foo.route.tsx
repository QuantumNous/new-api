import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/deep/$baz_/bar/$foo')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-deep-baz-bar-foo-route-heading">
        Hello deeply nested named baz/bar/foo route layout
      </div>
      <Outlet />
    </div>
  )
}
