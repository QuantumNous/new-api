import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/path/baz/foo')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()

  return (
    <div>
      <div data-testid="non-nested-path-baz-foo-heading">
        Hello nested path baz foo page
      </div>
      <div data-testid="non-nested-path-baz-foo-param">
        {JSON.stringify(params)}
      </div>
    </div>
  )
}
