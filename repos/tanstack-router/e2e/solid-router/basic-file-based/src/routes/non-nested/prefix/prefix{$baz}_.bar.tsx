import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/prefix/prefix{$baz}_/bar')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-prefix-baz-bar-heading">
        Hello non-nested prefix bar
      </div>
      <div data-testid="non-nested-prefix-baz-bar-param">
        {JSON.stringify(params())}
      </div>
    </div>
  )
}
