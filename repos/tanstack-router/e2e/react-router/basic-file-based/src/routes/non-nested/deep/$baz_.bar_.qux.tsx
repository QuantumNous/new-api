import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/deep/$baz_/bar_/qux')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-deep-baz-bar-qux-heading">
        Hello deeply nested baz/bar/qux
      </div>
      <div data-testid="non-nested-deep-baz-bar-qux-param">
        {JSON.stringify(params)}
      </div>
    </div>
  )
}
