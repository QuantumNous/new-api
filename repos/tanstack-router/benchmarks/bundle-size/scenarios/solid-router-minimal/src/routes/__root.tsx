import { Outlet, createRootRoute } from '@tanstack/solid-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return <Outlet />
}
