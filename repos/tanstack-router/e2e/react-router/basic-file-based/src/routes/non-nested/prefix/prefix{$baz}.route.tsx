import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/prefix/prefix{$baz}')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-prefix-baz-route-heading">
        Hello non-nested prefix route layout
      </div>
      <Outlet />
    </div>
  )
}
