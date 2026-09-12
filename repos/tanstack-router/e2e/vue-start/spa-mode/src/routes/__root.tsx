/// <reference types="vite/client" />
import {
  Body,
  ClientOnly,
  HeadContent,
  Html,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/vue-router'
import { TanStackRouterDevtools } from '@tanstack/vue-router-devtools'
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
    const loaderData = Route.useLoaderData()
    const context = Route.useRouteContext()
    return (
      <div data-testid="root-container">
        <h2 data-testid="root-heading">root</h2>
        <div>
          loader: <b data-testid="root-loader">{loaderData.value.root}</b>
        </div>
        <div>
          context: <b data-testid="root-context">{context.value.root}</b>
        </div>
        <hr />
        <Outlet />
      </div>
    )
  },
  pendingComponent: () => <div>__root Loading...</div>,
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
          <h1>SPA Mode E2E Test</h1>
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
        <TanStackRouterDevtools position="bottom-right" />
      </Body>
    </Html>
  )
}
