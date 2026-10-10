import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/suffix/{$baz}suffix_/bar')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-suffix-baz-bar-heading">
        Hello non-nested suffix bar
      </div>
      <div data-testid="non-nested-suffix-baz-bar-param">
        {JSON.stringify(params)}
      </div>
    </div>
  )
}
