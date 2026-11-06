import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/suffix')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div data-testid="non-nested-suffix-root-route-heading">
        Hello non-nested suffix layout
      </div>
      <div>
        <Link
          from={Route.fullPath}
          to="{$baz}suffix"
          params={{ baz: 'baz' }}
          data-testid="to-suffix-index"
        >
          To suffix index
        </Link>
        <Link
          from={Route.fullPath}
          to="{$baz}suffix/foo"
          params={{ baz: 'baz' }}
          data-testid="to-suffix-foo"
        >
          To suffix foo
        </Link>
        <Link
          from={Route.fullPath}
          to="{$baz}suffix/foo"
          params={{ baz: 'baz2' }}
          data-testid="to-suffix-foo-2"
        >
          To suffix foo 2
        </Link>
        <Link
          from={Route.fullPath}
          to="{$baz}suffix/bar"
          params={{ baz: 'baz' }}
          data-testid="to-suffix-bar"
        >
          To suffix bar
        </Link>
        <Link
          from={Route.fullPath}
          to="{$baz}suffix/bar"
          params={{ baz: 'baz2' }}
          data-testid="to-suffix-bar-2"
        >
          To suffix bar 2
        </Link>
      </div>
      <Outlet />
    </div>
  )
}
