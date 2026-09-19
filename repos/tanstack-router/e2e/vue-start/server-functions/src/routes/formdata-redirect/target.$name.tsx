import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/formdata-redirect/target/$name')({
  component: RouteComponent,
})

function RouteComponent() {
  const params = Route.useParams()
  return (
    <div data-testid="formdata-redirect-target">
      Hello{' '}
      <span data-testid="formdata-redirect-target-name">
        {params.value.name}
      </span>
      !
    </div>
  )
}
