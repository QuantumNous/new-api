import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/대한민국/wildcard/$')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()

  return (
    <div>
      <h3 data-testid="unicode-wildcard-heading">Unicode Wildcard Params</h3>
      <div>
        Hello /대한민국/wildcard/
        <span data-testid="unicode-wildcard-params">{params()._splat}</span>
      </div>
    </div>
  )
}
