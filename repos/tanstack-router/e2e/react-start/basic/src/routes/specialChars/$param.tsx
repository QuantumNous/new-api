import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/specialChars/$param')({
  component: RouteComponent,
})

function RouteComponent() {
  const { param } = Route.useParams()
  return (
    <div>
      Hello "/specialChars/$param":{' '}
      <span data-testid={'special-param'}>{param}</span>
    </div>
  )
}
