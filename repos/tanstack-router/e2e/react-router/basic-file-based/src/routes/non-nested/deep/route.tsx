import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/deep')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-deep-root-route-heading">
        Hello non-nested deep layout
      </div>
      <div>
        <Link
          from={Route.fullPath}
          to="./$baz"
          params={{ baz: 'baz' }}
          data-testid="to-deep-baz"
        >
          To Baz
        </Link>
        <Link
          from={Route.fullPath}
          to="./$baz/bar"
          params={{ baz: 'baz-bar' }}
          data-testid="to-deep-baz-bar"
        >
          To named baz/bar
        </Link>
        <Link
          from={Route.fullPath}
          to="./$baz/bar/$foo"
          params={{ baz: 'baz-bar', foo: 'foo' }}
          data-testid="to-deep-baz-bar-foo"
        >
          To named baz/bar/foo
        </Link>
        <Link
          from={Route.fullPath}
          to="./$baz/bar/$foo/qux"
          params={{ baz: 'baz-bar-qux', foo: 'foo' }}
          data-testid="to-deep-baz-bar-foo-qux"
        >
          To named baz/bar/foo/qux
        </Link>
        <Link
          from={Route.fullPath}
          to="./$baz/bar/qux"
          params={{ baz: 'baz-bar-qux' }}
          data-testid="to-deep-baz-bar-qux"
        >
          To named baz/bar/qux
        </Link>
      </div>
      <Outlet />
    </div>
  )
}
