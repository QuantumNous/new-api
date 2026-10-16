import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/prefix')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-prefix-root-route-heading">
        Hello non-nested prefix layout
      </div>
      <div>
        <Link
          from={Route.fullPath}
          to="prefix{$baz}"
          params={{ baz: 'baz' }}
          data-testid="to-prefix-index"
        >
          To prefix index
        </Link>
        <Link
          from={Route.fullPath}
          to="prefix{$baz}/foo"
          params={{ baz: 'baz' }}
          data-testid="to-prefix-foo"
        >
          To prefix foo
        </Link>
        <Link
          from={Route.fullPath}
          to="prefix{$baz}/foo"
          params={{ baz: 'baz_' }}
          data-testid="to-prefix-foo-2"
        >
          To prefix foo 2
        </Link>
        <Link
          from={Route.fullPath}
          to="prefix{$baz}/bar"
          params={{ baz: 'baz' }}
          data-testid="to-prefix-bar"
        >
          To prefix bar
        </Link>
        <Link
          from={Route.fullPath}
          to="prefix{$baz}/bar"
          params={{ baz: 'baz_' }}
          data-testid="to-prefix-bar-2"
        >
          To prefix bar 2
        </Link>
      </div>
      <Outlet />
    </div>
  )
}
