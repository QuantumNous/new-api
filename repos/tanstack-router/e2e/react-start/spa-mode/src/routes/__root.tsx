/// <reference types="vite/client" />
import * as React from 'react'
import {
  ClientOnly,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import appCss from '~/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'SPA Mode E2E Test',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: () => {
    console.log(
      `beforeLoad for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )
    return {
      root: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  loader: () => {
    console.log(
      `loader for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )
    return { root: typeof window === 'undefined' ? 'server' : 'client' }
  },
  shellComponent: RootDocument,
  component: () => {
    return (
      <div data-testid="root-container">
        <h2 data-testid="root-heading">root</h2>
        <div>
          loader: <b data-testid="root-loader">{Route.useLoaderData().root}</b>
        </div>
        <div>
          context:{' '}
          <b data-testid="root-context">{Route.useRouteContext().root}</b>
        </div>
        <hr />
        <Outlet />
      </div>
    )
  },
  pendingComponent: () => <div>__root Loading...</div>,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const { isLoading, status } = useRouterState({
    select: (state) => ({ isLoading: state.isLoading, status: state.status }),
    structuralSharing: true,
  })
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <div className="p-2 flex gap-2 text-lg">
          <h1>SPA Mode E2E Test</h1>
          <Link
            to="/"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Home
          </Link>
        </div>
        <hr />
        <ClientOnly>
          <div>
            router isLoading:{' '}
            <b data-testid="router-isLoading">{isLoading ? 'true' : 'false'}</b>
          </div>
          <div>
            router status: <b data-testid="router-status">{status}</b>
          </div>
        </ClientOnly>
        <hr />
        {children}
        <Scripts />
        <TanStackRouterDevtools position="bottom-right" />
      </body>
    </html>
  )
}
