import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/deep/$baz/')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-deep-baz-index-heading">
        Hello deeply nested baz index
      </div>
      <div data-testid="non-nested-deep-baz-index-param">
        {JSON.stringify(params())}
      </div>
    </div>
  )
}
