import { Outlet, createRootRoute } from '@tanstack/vue-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return <Outlet />
}
