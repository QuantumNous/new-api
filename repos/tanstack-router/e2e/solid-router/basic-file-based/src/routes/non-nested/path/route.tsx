import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/path')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-path-root-route-heading">
        Hello non-nested path layout
      </div>
      <div>
        <Link from={Route.fullPath} to="./baz" data-testid="to-path-index">
          To path index
        </Link>
        <Link from={Route.fullPath} to="./baz/foo" data-testid="to-path-foo">
          To path foo
        </Link>
        <Link from={Route.fullPath} to="./baz/foo" data-testid="to-path-foo-2">
          To path foo 2
        </Link>
        <Link from={Route.fullPath} to="./baz/bar" data-testid="to-path-bar">
          To path bar
        </Link>
        <Link from={Route.fullPath} to="./baz/bar" data-testid="to-path-bar-2">
          To path bar 2
        </Link>
      </div>
      <Outlet />
    </div>
  )
}
