import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/params-ps/named/$foo/$bar/$baz')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      Hello "/params-ps/named/$foo/$bar/$baz"!
      <div>
        baz: <span data-testid="foo-bar-baz-value">{params().baz}</span>
      </div>
    </div>
  )
}
