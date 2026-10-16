import { notFound, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/not-found/via-loader')({
  loader: () => {
    throw notFound()
  },
  component: RouteComponent,
  notFoundComponent: () => {
    return (
      <div data-testid="via-loader-notFound-component">
        Not Found "/not-found/via-loader"!
      </div>
    )
  },
})

function RouteComponent() {
  return (
    <div data-testid="via-loader-route-component" data-server={typeof window}>
      Hello "/not-found/via-loader"!
    </div>
  )
}
