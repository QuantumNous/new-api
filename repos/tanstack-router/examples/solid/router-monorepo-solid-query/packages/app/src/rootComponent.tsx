import { Link, Outlet } from '@router-solid-mono-solid-query/router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import { SolidQueryDevtools } from '@tanstack/solid-query-devtools'

export function RootComponent() {
  return (
    <>
      <div class="p-2 flex gap-2 text-lg">
        <Link
          to="/"
          activeProps={{
            class: 'font-bold',
          }}
          activeOptions={{ exact: true }}
        >
          Posts list
        </Link>
      </div>
      <hr />
      <Outlet />
      <SolidQueryDevtools buttonPosition="top-right" />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
