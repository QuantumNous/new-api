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
import { z } from 'zod'
import { ssrSchema } from '~/search'
import appCss from '~/styles/app.css?url'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

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
        title: 'Selective SSR E2E Test',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  validateSearch: z.object({ root: ssrSchema }),
  ssr: ({ search }) => {
    if (typeof window !== 'undefined') {
      const error = `ssr() for ${Route.id} should not be called on the client`
      console.error(error)
      throw new Error(error)
    }
    if (search.status === 'success') {
      return search.value.root?.ssr
    }
  },
  beforeLoad: ({ search }) => {
    console.log(
      `beforeLoad for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )
    if (
      search.root?.expected?.data === 'client' &&
      typeof window === 'undefined'
    ) {
      const error = `Expected beforeLoad for ${Route.id} to be executed on the client, but it is running on the server`
      console.error(error)
      throw new Error(error)
    }
    return {
      root: typeof window === 'undefined' ? 'server' : 'client',
      search,
    }
  },
  loader: ({ context }) => {
    console.log(
      `loader for ${Route.id} called on the ${typeof window !== 'undefined' ? 'client' : 'server'}`,
    )

    if (
      context.search.root?.expected?.data === 'client' &&
      typeof window === 'undefined'
    ) {
      const error = `Expected loader for ${Route.id} to be executed on the client, but it is running on the server`
      console.error(error)
      throw new Error(error)
    }
    return { root: typeof window === 'undefined' ? 'server' : 'client' }
  },
  shellComponent: RootDocument,
  component: () => {
    const search = Route.useSearch()
    if (
      typeof window === 'undefined' &&
      search.root?.expected?.render === 'client-only'
    ) {
      const error = `Expected component for ${Route.id} to be executed on the client, but it is running on the server`
      console.error(error)
      throw new Error(error)
    }
    return (
      <div data-testid="root-container">
        <h2 data-testid="root-heading">root</h2>
        <div>
          ssr:{' '}
          <b>{JSON.stringify(Route.useSearch().root?.ssr ?? 'undefined')}</b>
        </div>
        <div>
          expected data location execution:{' '}
          <b data-testid="root-data-expected">
            {Route.useSearch().root?.expected?.data}
          </b>
        </div>
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
          <h1>Selective SSR E2E Test</h1>
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
