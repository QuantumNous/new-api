/// <reference types="vite/client" />
import * as React from 'react'
import {
  ClientOnly,
  HeadContent,
  Link,
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
        title: 'Serialization Adapters E2E Test',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
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
          <h1>Serialization Adapters E2E Test</h1>
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
