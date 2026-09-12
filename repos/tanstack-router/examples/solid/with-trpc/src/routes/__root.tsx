import {
  Link,
  Outlet,
  createRootRouteWithContext,
  useRouterState,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'

import { Spinner } from './-components/spinner'
import type { trpc } from '../trpc'

export interface RouterAppContext {
  trpc: typeof trpc
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
})

function RootComponent() {
  const isFetching = useRouterState({ select: (s) => s.isLoading })

  return (
    <>
      <div class={`min-h-screen flex flex-col`}>
        <div class={`flex items-center border-b gap-2`}>
          <h1 class={`text-3xl p-2`}>With tRPC</h1>
          {/* Show a global spinner when the router is transitioning */}
          <div
            class={`text-3xl duration-300 delay-0 opacity-0 ${
              isFetching() ? ` duration-1000 opacity-40` : ''
            }`}
          >
            <Spinner />
          </div>
        </div>
        <div class={`flex-1 flex`}>
          <div class={`divide-y w-56`}>
            {(
              [
                ['/', 'Home'],
                ['/dashboard', 'Dashboard'],
              ] as const
            ).map(([to, label]) => {
              return (
                <div>
                  <Link
                    to={to}
                    activeOptions={
                      {
                        // If the route points to the root of it's parent,
                        // make sure it's only active if it's exact
                        // exact: to === '.',
                      }
                    }
                    preload="intent"
                    class={`block py-2 px-3 text-blue-700`}
                    // Make "active" links bold
                    activeProps={{ class: `font-bold` }}
                  >
                    {label}
                  </Link>
                </div>
              )
            })}
          </div>
          <div class={`flex-1 border-l border-gray-200`}>
            {/* Render our first route match */}
            <Outlet />
          </div>
        </div>
      </div>
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
