/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/solid-router'
import { TanStackRouterDevtoolsInProd } from '@tanstack/solid-router-devtools'
import { HydrationScript } from 'solid-js/web'
import type { QueryClient } from '@tanstack/solid-query'
import appCss from '~/styles/app.css?url'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charset: 'utf-8',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument(props: { children?: any }) {
  return (
    <html>
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
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
          {/* <Link
            to="/useSuspenseQuery"
            activeProps={{
              class: 'font-bold',
            }}
          >
            useSuspenseQuery
          </Link>{' '} */}
        </div>
        <hr />
        {props.children}
        <TanStackRouterDevtoolsInProd position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
