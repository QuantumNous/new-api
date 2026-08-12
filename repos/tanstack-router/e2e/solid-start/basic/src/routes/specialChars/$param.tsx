import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/specialChars/$param')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      Hello "/specialChars/$param":{' '}
      <span data-testid={'special-param'}>{params().param}</span>
    </div>
  )
}
