import { createFileRoute, notFound } from '@tanstack/vue-router'
import { Route as ParentBoundaryRoute } from './route'

export const Route = createFileRoute(
  '/not-found/parent-boundary/via-beforeLoad',
)({
  beforeLoad: () => {
    throw notFound({ routeId: ParentBoundaryRoute.id })
  },
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="parent-boundary-child-route-component">
      Hello "/not-found/parent-boundary/via-beforeLoad"!
    </div>
  )
}
