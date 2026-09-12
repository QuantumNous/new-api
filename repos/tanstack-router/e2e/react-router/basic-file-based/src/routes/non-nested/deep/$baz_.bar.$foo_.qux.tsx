import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/deep/$baz_/bar/$foo_/qux')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-deep-baz-bar-foo-qux-heading">
        Hello deeply nested baz/bar/foo/qux
      </div>
      <div data-testid="non-nested-deep-baz-bar-foo-qux-param">
        {JSON.stringify(params)}
      </div>
    </div>
  )
}
