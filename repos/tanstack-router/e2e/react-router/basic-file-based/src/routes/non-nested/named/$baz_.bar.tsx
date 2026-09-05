import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/named/$baz_/bar')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-named-baz-bar-heading">
        Hello non-nested named bar
      </div>
      <div data-testid="non-nested-named-baz-bar-param">
        {JSON.stringify(params)}
      </div>
    </div>
  )
}
