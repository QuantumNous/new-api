import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/path/baz/')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-path-baz-index-heading">
        Hello nested path baz index
      </div>
      <div data-testid="non-nested-path-baz-index-param">
        {JSON.stringify(params())}
      </div>
    </div>
  )
}
