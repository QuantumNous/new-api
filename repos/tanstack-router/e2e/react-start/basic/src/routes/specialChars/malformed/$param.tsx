import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/specialChars/malformed/$param')({
  component: RouteComponent,
})

function RouteComponent() {
  const { param } = Route.useParams()
  return (
    <div>
      Hello "/specialChars/malformed/$param":{' '}
      <span data-testid={'special-malformed-param'}>{param}</span>
    </div>
  )
}
