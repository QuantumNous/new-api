import {
  HeadContent,
  Link,
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/solid-router'
import { SolidQueryDevtools } from '@tanstack/solid-query-devtools'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import type { QueryClient } from '@tanstack/solid-query'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div>
        <p>This is the notFoundComponent configured on root route</p>
        <Link to="/">Start Over</Link>
      </div>
    )
  },
})

function RootComponent() {
  return (
    <>
      <HeadContent />
      <div class="p-2 flex gap-2 text-lg">
        <Link
          to="/"
          activeProps={{
            class: 'font-bold',
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>{' '}
        <Link
          to="/posts"
          activeProps={{
            class: 'font-bold',
          }}
        >
          Posts
        </Link>{' '}
        <Link
          to="/route-a"
          activeProps={{
            class: 'font-bold',
          }}
        >
          Pathless Layout
        </Link>{' '}
        <Link
          // @ts-expect-error
          to="/this-route-does-not-exist"
          activeProps={{
            class: 'font-bold',
          }}
        >
          This Route Does Not Exist
        </Link>
      </div>
      <hr />
      <Outlet />
      <SolidQueryDevtools buttonPosition="top-right" />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
