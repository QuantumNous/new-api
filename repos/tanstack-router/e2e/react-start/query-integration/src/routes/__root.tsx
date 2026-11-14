/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { TanStackRouterDevtoolsInProd } from '@tanstack/react-router-devtools'
import * as React from 'react'
import type { QueryClient } from '@tanstack/react-query'
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
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="p-2 flex gap-2 text-lg">
          <Link
            to="/"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Home
          </Link>{' '}
          <Link
            to="/loader-fetchQuery/$type"
            params={{ type: 'sync' }}
            activeProps={{
              className: 'font-bold',
            }}
          >
            fetchQuery (sync)
          </Link>{' '}
          <Link
            to="/loader-fetchQuery/$type"
            params={{ type: 'async' }}
            activeProps={{
              className: 'font-bold',
            }}
          >
            fetchQuery (async)
          </Link>{' '}
          <Link
            to="/useQuery"
            activeProps={{
              className: 'font-bold',
            }}
          >
            useQuery
          </Link>{' '}
          <Link
            to="/useSuspenseQuery"
            activeProps={{
              className: 'font-bold',
            }}
          >
            useSuspenseQuery
          </Link>{' '}
        </div>
        <hr />
        {children}
        <TanStackRouterDevtoolsInProd position="bottom-right" />
        <ReactQueryDevtools buttonPosition="bottom-left" />
        <Scripts />
      </body>
    </html>
  )
}
