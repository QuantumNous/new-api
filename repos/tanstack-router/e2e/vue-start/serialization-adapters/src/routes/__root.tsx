/// <reference types="vite/client" />
import {
  Body,
  ClientOnly,
  HeadContent,
  Html,
  Link,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/vue-router'
import { TanStackRouterDevtoolsInProd } from '@tanstack/vue-router-devtools'
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
  notFoundComponent: (e) => <div>404 - Not Found {JSON.stringify(e.data)}</div>,
})

function RootDocument(_: unknown, { slots }: { slots: any }) {
  const routerState = useRouterState({
    select: (state) => ({ isLoading: state.isLoading, status: state.status }),
  })
  return (
    <Html>
      <head>
        <HeadContent />
      </head>
      <Body>
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
            <b data-testid="router-isLoading">
              {routerState.value.isLoading ? 'true' : 'false'}
            </b>
          </div>
          <div>
            router status:{' '}
            <b data-testid="router-status">{routerState.value.status}</b>
          </div>
        </ClientOnly>
        <hr />
        {slots.default?.()}
        <Scripts />
        <TanStackRouterDevtoolsInProd position="bottom-right" />
      </Body>
    </Html>
  )
}
