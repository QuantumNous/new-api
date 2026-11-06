import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/named/$baz/foo')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()

  return (
    <div>
      <div data-testid="non-nested-named-baz-foo-heading">
        Hello nested named baz foo page
      </div>
      <div data-testid="non-nested-named-baz-foo-param">
        {JSON.stringify(params)}
      </div>
    </div>
  )
}
