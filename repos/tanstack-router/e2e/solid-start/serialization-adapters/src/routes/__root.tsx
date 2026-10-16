/// <reference types="vite/client" />
import {
  ClientOnly,
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import { HydrationScript } from 'solid-js/web'
import type { JSX } from 'solid-js'
import appCss from '~/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charset: 'utf-8',
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
  notFoundComponent: (e) => <div>404 - Not Found {JSON.stringify(e.data)}</div>,
})

function RootDocument({ children }: { children: JSX.Element }) {
  const { isLoading, status } = useRouterState({
    select: (state) => ({ isLoading: state.isLoading, status: state.status }),
  })()
  return (
    <html>
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        <div class="p-2 flex gap-2 text-lg">
          <h1>Serialization Adapters E2E Test</h1>
          <Link
            to="/"
            activeProps={{
              class: 'font-bold',
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
