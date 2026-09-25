import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { RenderCounter } from '../../../../components/RenderCounter'

export const Route = createFileRoute('/params-ps/named/$foo')({
  component: RouteComponent,
})

function RouteComponent() {
  const foo = Route.useParams()
  return (
    <div>
      <h3>ParamsNamedFoo</h3>
      <div>
        RenderCount:{' '}
        <span data-testid="foo-render-count">
          <RenderCounter />
        </span>
      </div>
      <div data-testid="params-output">{JSON.stringify(foo)}</div>
      <Link from={Route.fullPath} to="." data-testid="params-foo-links-index">
        Index
      </Link>
      <Link
        from={Route.fullPath}
        to="./$bar"
        params={{ bar: '1' }}
        data-testid="params-foo-links-bar1"
      >
        Bar1
      </Link>
      <Link
        from={Route.fullPath}
        to="./$bar"
        params={{ bar: '2' }}
        data-testid="params-foo-links-bar2"
      >
        Bar2
      </Link>
      <Link
        from={Route.fullPath}
        to="./$bar"
        params={{ bar: '🚀%2F/abc대' }}
        data-testid="params-foo-links-bar-special-characters"
      >
        Bar with special characters
      </Link>
      <Outlet />
    </div>
  )
}
