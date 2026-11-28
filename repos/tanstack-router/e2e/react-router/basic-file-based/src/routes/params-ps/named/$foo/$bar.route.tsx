import {
  Link,
  Outlet,
  createFileRoute,
  useParams,
} from '@tanstack/react-router'
import { RenderCounter } from '../../../../components/RenderCounter'

export const Route = createFileRoute('/params-ps/named/$foo/$bar')({
  component: RouteComponent,
})

function RouteComponent() {
  const { foo, bar, baz } = useParams({
    strict: false,
  })

  return (
    <div>
      Hello "/params-ps/named/{foo}/{bar}"!
      <div>
        Bar Render Count:{' '}
        <span data-testid="foo-bar-render-count">
          <RenderCounter />
        </span>
      </div>
      <div>
        Bar: <span data-testid="foo-bar-value">{bar}</span>
      </div>
      <div>
        Baz in Bar:{' '}
        <span data-testid="foo-baz-in-bar-value">{baz ?? 'no param'}</span>
      </div>
      <Link
        data-testid="params-foo-bar-links-baz"
        from={Route.fullPath}
        to="./$baz"
        params={{ baz: `${bar}_10` }}
      >
        To Baz
      </Link>
      <Outlet />
    </div>
  )
}
