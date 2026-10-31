/// <reference types="vite/client" />
import {
  Body,
  HeadContent,
  Html,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/vue-router'
import { VueQueryDevtools } from '@tanstack/vue-query-devtools'
import { TanStackRouterDevtoolsInProd } from '@tanstack/vue-router-devtools'
import type { QueryClient } from '@tanstack/vue-query'
import appCss from '~/styles/app.css?url'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <Html>
      <head>
        <HeadContent />
      </head>
      <Body>
        <div class="p-2 flex gap-2 text-lg">
          <Link
            to="/"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Home
          </Link>{' '}
          <Link
            to="/loader-fetchQuery/$type"
            params={{ type: 'sync' }}
            activeProps={{
              class: 'font-bold',
            }}
          >
            fetchQuery (sync)
          </Link>{' '}
          <Link
            to="/loader-fetchQuery/$type"
            params={{ type: 'async' }}
            activeProps={{
              class: 'font-bold',
            }}
          >
            fetchQuery (async)
          </Link>{' '}
          <Link
            to="/useQuery"
            activeProps={{
              class: 'font-bold',
            }}
          >
            useQuery
          </Link>{' '}
        </div>
        <hr />
        <Outlet />
        <TanStackRouterDevtoolsInProd position="bottom-right" />
        <VueQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </Body>
    </Html>
  )
}
