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
import { TanStackRouterDevtoolsInProd } from '@tanstack/vue-router-devtools'
import type { QueryClient } from '@tanstack/vue-query'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import appCss from '~/styles/app.css?url'
import { seo } from '~/utils/seo'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      ...seo({
        title:
          'TanStack Start | Type-Safe, Client-First, Full-Stack Vue Framework',
        description: `TanStack Start is a type-safe, client-first, full-stack Vue framework.`,
      }),
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
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
  }),
  errorComponent: (props) => {
    return (
      <RootDocument>
        <DefaultCatchBoundary {...props} />
      </RootDocument>
    )
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument(_: unknown, { slots }: { slots: any }) {
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
            to="/deferred"
            activeProps={{
              class: 'font-bold',
            }}
          >
            Deferred
          </Link>{' '}
          <Link
            // @ts-expect-error
            to="/this-route-does-not-exist"
          >
            This Route Does Not Exist
          </Link>
        </div>
        <hr />
        {slots.default?.()}
        <TanStackRouterDevtoolsInProd position="bottom-right" />
        <Scripts />
      </Body>
    </Html>
  )
}
