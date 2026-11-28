import {
  Link,
  Outlet,
  createFileRoute,
  useParams,
} from '@tanstack/react-router'

export const Route = createFileRoute('/params-ps/strict-false')({
  component: RouteComponent,
})

function RouteComponent() {
  const { version } = useParams({ strict: false })
  return (
    <div>
      <h3>ParamsStrictFalseParse</h3>
      <div>
        Type:{' '}
        <span data-testid="strict-false-version-type">{typeof version}</span>
      </div>
      <div>
        Value:{' '}
        <span data-testid="strict-false-version-value">{String(version)}</span>
      </div>
      <Link
        data-testid="strict-false-version-1"
        from={Route.fullPath}
        to="./$version"
        params={{ version: 1 }}
      >
        Version 1
      </Link>
      <Link
        data-testid="strict-false-version-2"
        from={Route.fullPath}
        to="./$version"
        params={{ version: 2 }}
      >
        Version 2
      </Link>
      <Outlet />
    </div>
  )
}
