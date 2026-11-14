import { createFileRoute } from '@tanstack/solid-router'
export const Route = createFileRoute('/params-ps/wildcard/$')({
  component: RouteComponent,
})

function RouteComponent() {
  const p = Route.useParams()
  return (
    <div>
      <h3>ParamsWildcardSplat</h3>
      <div data-testid="params-output">{JSON.stringify(p())}</div>
    </div>
  )
}
