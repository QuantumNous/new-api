import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/deep/$baz_/bar/')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-deep-baz-bar-index-heading">
        Hello deeply nested baz/bar index
      </div>
      <div data-testid="non-nested-deep-baz-bar-index-param">
        {JSON.stringify(params)}
      </div>
    </div>
  )
}
