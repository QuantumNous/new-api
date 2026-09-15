import { createFileRoute, notFound } from '@tanstack/react-router'
import z from 'zod'
import { Route as ParentBoundaryRoute } from './route'

export const Route = createFileRoute(
  '/not-found/parent-boundary/via-beforeLoad',
)({
  validateSearch: z.object({
    target: z.enum(['parent', 'none']).optional(),
  }),
  beforeLoad: ({ search }) => {
    if (search.target === 'none') {
      throw notFound({
        data: { source: 'without-routeId' },
      })
    }

    throw notFound({
      routeId: ParentBoundaryRoute.id,
      data: { source: 'with-routeId' },
    })
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
