import { createFileRoute, notFound, rootRouteId } from '@tanstack/vue-router'

export const Route = createFileRoute('/not-found/via-beforeLoad-target-root')({
  beforeLoad: () => {
    throw notFound({ routeId: rootRouteId })
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="via-beforeLoad-target-root-route-component">
      Hello "/not-found/via-beforeLoad-target-root"!
    </div>
  )
}
