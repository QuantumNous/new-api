import { createFileRoute } from '@tanstack/react-router'
import { redirect } from '@tanstack/react-router'

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
