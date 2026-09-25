import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/deep/$baz_/bar/$foo/')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-deep-baz-bar-foo-index-heading">
        Hello deeply nested baz/bar/foo index
      </div>
      <div data-testid="non-nested-deep-baz-bar-foo-index-param">
        {JSON.stringify(params)}
      </div>
    </div>
  )
}
