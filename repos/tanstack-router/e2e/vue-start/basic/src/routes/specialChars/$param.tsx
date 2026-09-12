import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/specialChars/$param')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div>
      Hello "/specialChars/$param":{' '}
      <span data-testid={'special-param'}>{params.value.param}</span>
    </div>
  )
}
