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

import { TanStackRouterDevtoolsInProd } from '@tanstack/vue-router-devtools'
import { NotFound } from '~/components/NotFound'
import '~/styles/app.css'
import { seo } from '~/utils/seo'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title:
          'TanStack Start | Type-Safe, Client-First, Full-Stack Vue Framework',
        description: `TanStack Start is a type-safe, client-first, full-stack Vue framework. `,
      }),
    ],
    links: [
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/apple-touch-icon.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        href: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        href: '/favicon-16x16.png',
      },
      { rel: 'manifest', href: '/site.webmanifest', color: '#fffff' },
      { rel: 'icon', href: '/favicon.ico' },
    ],
    styles: [
      {
        media: 'all and (min-width: 500px)',
        children: `
        .inline-div {
          color: white;
          background-color: gray;
          max-width: 250px;
        }`,
      },
    ],
  }),
  errorComponent: (props) => <p>{props.error.stack}</p>,
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
})

function RootComponent() {
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
          <Link
            to="/"
            activeProps={{
              class: 'font-bold',
            }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>{' '}
          <Link
            to="/posts"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Posts
          </Link>{' '}
          <Link
            to="/users"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Users
          </Link>{' '}
          <Link
            to="/layout-a"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Layout
          </Link>{' '}
          <Link
            to="/scripts"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Scripts
          </Link>{' '}
          <Link
            to="/inline-scripts"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Inline Scripts
          </Link>{' '}
          <Link
            to="/deferred"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Deferred
          </Link>{' '}
          <Link
            to="/redirect"
            activeProps={{
              class: 'font-bold',
            }}
          >
            redirect
          </Link>{' '}
          <Link
            to="/raw-stream"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Raw Stream
          </Link>{' '}
          <Link
            // @ts-expect-error
            to="/this-route-does-not-exist"
            activeProps={{
              class: 'font-bold',
            }}
          >
            This Route Does Not Exist
          </Link>
        </div>
        <ClientOnly>
          <div hidden>
            <b data-testid="router-isLoading">
              {routerState.value.isLoading ? 'true' : 'false'}
            </b>
            <b data-testid="router-status">{routerState.value.status}</b>
          </div>
        </ClientOnly>
        <Outlet />
        <div class="inline-div">This is an inline styled div</div>
        <TanStackRouterDevtoolsInProd />
        <Scripts />
      </Body>
    </Html>
  )
}
