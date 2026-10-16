import * as React from 'react'
import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { type QueryClient } from '@tanstack/react-query'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export interface Context {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<Context>()({
  component: RootComponent,
  notFoundComponent: () => {
    return <p>Not Found (on root route)</p>
  },
})

function RootComponent() {
  return (
    <>
      <div className="p-2 flex gap-2 text-lg">
        <Link
          to="/"
          activeProps={{
            className: 'font-bold',
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>
      </div>
      <hr />
      <Outlet />
      {/* Start rendering router matches */}
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
