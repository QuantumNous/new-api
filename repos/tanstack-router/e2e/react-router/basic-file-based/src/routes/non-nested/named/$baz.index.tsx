import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/named/$baz/')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-named-baz-index-heading">
        Hello nested named baz index
      </div>
      <div data-testid="non-nested-named-baz-index-param">
        {JSON.stringify(params)}
      </div>
    </div>
  )
}
