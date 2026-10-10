import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested/suffix/{$baz}suffix/')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      <div data-testid="non-nested-suffix-baz-index-heading">
        Hello nested suffix index
      </div>
      <div data-testid="non-nested-suffix-baz-index-param">
        {JSON.stringify(params)}
      </div>
    </div>
  )
}
