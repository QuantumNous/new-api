import { notFound, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/not-found/via-beforeLoad')({
  beforeLoad: () => {
    throw notFound()
  },
  component: RouteComponent,
  notFoundComponent: () => {
    return (
      <div data-testid="via-beforeLoad-notFound-component">
        Not Found "/not-found/via-beforeLoad"!
      </div>
    )
  },
})

function RouteComponent() {
  return (
    <div data-testid="via-beforeLoad-route-component">
      Hello "/not-found/via-beforeLoad"!
    </div>
  )
}
