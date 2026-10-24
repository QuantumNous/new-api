import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/non-nested/suffix/{$baz}suffix/foo')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()

  return (
    <div>
      <div data-testid="non-nested-suffix-baz-foo-heading">
        Hello nested suffix foo page
      </div>
      <div data-testid="non-nested-suffix-baz-foo-param">
        {JSON.stringify(params())}
      </div>
    </div>
  )
}
