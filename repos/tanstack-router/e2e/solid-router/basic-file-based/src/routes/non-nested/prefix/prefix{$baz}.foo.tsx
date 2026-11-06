import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/prefix/prefix{$baz}/foo')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()

  return (
    <div>
      <div data-testid="non-nested-prefix-baz-foo-heading">
        Hello nested prefix foo page
      </div>
      <div data-testid="non-nested-prefix-baz-foo-param">
        {JSON.stringify(params())}
      </div>
    </div>
  )
}
