import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/formdata-redirect/target/$name')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="formdata-redirect-target">
      Hello{' '}
      <span data-testid="formdata-redirect-target-name">
        {Route.useParams().name}
      </span>
      !
    </div>
  )
}
