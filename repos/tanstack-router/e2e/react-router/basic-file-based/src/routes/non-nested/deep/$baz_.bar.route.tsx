import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/deep/$baz_/bar')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-deep-baz-bar-route-heading">
        Hello deeply nested baz/bar route layout
      </div>
      <Outlet />
    </div>
  )
}
