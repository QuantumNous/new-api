import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/path/baz_/bar')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-path-baz-bar-heading">
        Hello non-nested path bar
      </div>
      <div data-testid="non-nested-path-baz-bar-param">
        {JSON.stringify(params())}
      </div>
    </div>
  )
}
