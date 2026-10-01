import { createFileRoute, useParams } from '@tanstack/solid-router'

export const Route = createFileRoute('/params-ps/non-nested/$foo_/$bar')({
  component: RouteComponent,
})

function RouteComponent() {
  const fooParams = useParams({ from: `/params-ps/non-nested/$foo_` })
  const routeParams = Route.useParams()

  return (
    <div>
      <div data-testid="foo-params-value">{JSON.stringify(fooParams())}</div>
      <div data-testid="foo-bar-params-value">
        {JSON.stringify(routeParams())}
      </div>
    </div>
  )
}
