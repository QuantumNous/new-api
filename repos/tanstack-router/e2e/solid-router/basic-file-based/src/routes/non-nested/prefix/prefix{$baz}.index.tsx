import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/prefix/prefix{$baz}/')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-prefix-baz-index-heading">
        Hello nested prefix index
      </div>
      <div data-testid="non-nested-prefix-baz-index-param">
        {JSON.stringify(params())}
      </div>
    </div>
  )
}
