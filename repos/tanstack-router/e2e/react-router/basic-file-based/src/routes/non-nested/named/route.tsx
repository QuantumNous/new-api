import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/named')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-named-root-route-heading">
        Hello non-nested named layout
      </div>
      <div>
        <Link
          from={Route.fullPath}
          to="./$baz"
          params={{ baz: 'baz' }}
          data-testid="to-named-index"
        >
          To named index
        </Link>
        <Link
          from={Route.fullPath}
          to="./$baz/foo"
          params={{ baz: 'baz' }}
          data-testid="to-named-foo"
        >
          To named foo
        </Link>
        <Link
          from={Route.fullPath}
          to="./$baz/foo"
          params={{ baz: 'baz_' }}
          data-testid="to-named-foo-2"
        >
          To named foo 2
        </Link>
        <Link
          from={Route.fullPath}
          to="./$baz/bar"
          params={{ baz: 'baz' }}
          data-testid="to-named-bar"
        >
          To named bar
        </Link>
        <Link
          from={Route.fullPath}
          to="./$baz/bar"
          params={{ baz: 'baz_' }}
          data-testid="to-named-bar-2"
        >
          To named bar 2
        </Link>
      </div>
      <Outlet />
    </div>
  )
}
