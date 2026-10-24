import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/named/$baz')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-named-baz-route-heading">
        Hello non-nested named baz route layout
      </div>
      <Outlet />
    </div>
  )
}
