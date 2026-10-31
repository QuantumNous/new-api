import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/specialChars/malformed/$param')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      Hello "/specialChars/malformed/$param":{' '}
      <span data-testid={'special-malformed-param'}>{params().param}</span>
    </div>
  )
}
