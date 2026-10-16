import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/params-ps/named/$foo/$bar/$baz')({
  component: RouteComponent,
})

function RouteComponent() {
  const { foo, bar, baz } = Route.useParams()
  return (
    <div>
      Hello "/params-ps/named/{foo}/{bar}/{baz}"!
      <div>
        baz: <span data-testid="foo-bar-baz-value">{baz}</span>
      </div>
    </div>
  )
}
