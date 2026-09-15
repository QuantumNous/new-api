import { Outlet, createRootRouteWithContext } from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import type { QueryClient } from '@tanstack/solid-query'

export interface Context {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<Context>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <div class="m-4">
      <Outlet />
      <TanStackRouterDevtools />
    </div>
  )
}
