import { createFileRoute } from '@tanstack/solid-router'
import { redirect } from '@tanstack/solid-router'

export const Route = createFileRoute('/redirect/preload/second')({
  loader: async () => {
    await new Promise((r) => setTimeout(r, 1000))
    throw redirect({ from: Route.fullPath, to: '../third' })
  },
  component: RouteComponent,
  pendingComponent: () => <p>second pending</p>,
})

function RouteComponent() {
  return <div data-testid="second">Hello "/redirect/preload/second"!</div>
}
