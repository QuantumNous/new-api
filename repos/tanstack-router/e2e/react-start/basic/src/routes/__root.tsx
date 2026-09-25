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

import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import '~/styles/app.css'
import { seo } from '~/utils/seo'

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
      ...seo({
        title:
          'TanStack Start | Type-Safe, Client-First, Full-Stack React Framework',
        description: `TanStack Start is a type-safe, client-first, full-stack React framework. `,
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

const RouterDevtools =
  process.env.NODE_ENV === 'production'
    ? () => null // Render nothing in production
    : React.lazy(() =>
        // Lazy load in development
        import('@tanstack/react-router-devtools').then((res) => ({
          default: res.TanStackRouterDevtools,
        })),
      )

function RootDocument({ children }: { children: React.ReactNode }) {
  const { isLoading, status } = useRouterState({
    select: (state) => ({ isLoading: state.isLoading, status: state.status }),
    structuralSharing: true,
  })

  return (
    <html>
      <head>
        <HeadContent />
        <script src="/head-script.js" />
        <script src="/head-async-script.js" async={true} />
      </head>
      <body>
        <div className="p-2 flex gap-2 text-lg">
          <Link
            to="/"
            activeProps={{
              className: 'font-bold',
            }}
            activeOptions={{ exact: true }}
          >
            Home
          </Link>{' '}
          <Link
            to="/posts"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Posts
          </Link>{' '}
          <Link
            to="/users"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Users
          </Link>{' '}
          <Link
            to="/layout-a"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Layout
          </Link>{' '}
          <Link
            to="/scripts"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Scripts
          </Link>{' '}
          <Link
            to="/async-scripts"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Async Scripts
          </Link>{' '}
          <Link
            to="/inline-scripts"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Inline Scripts
          </Link>{' '}
          <Link
            to="/deferred"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Deferred
          </Link>{' '}
          <Link
            to="/redirect"
            activeProps={{
              className: 'font-bold',
            }}
          >
            redirect
          </Link>{' '}
          <Link
            to="/not-found"
            activeProps={{
              className: 'font-bold',
            }}
          >
            not-found
          </Link>{' '}
          <Link
            to="/client-only"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Client Only
          </Link>{' '}
          <Link
            to="/raw-stream"
            activeProps={{
              className: 'font-bold',
            }}
          >
            Raw Stream
          </Link>{' '}
          <Link
            // @ts-expect-error
            to="/this-route-does-not-exist"
            activeProps={{
              className: 'font-bold',
            }}
          >
            This Route Does Not Exist
          </Link>
        </div>
        <hr />
        <ClientOnly>
          <div hidden>
            <b data-testid="router-isLoading">{isLoading ? 'true' : 'false'}</b>
            <b data-testid="router-status">{status}</b>
          </div>
        </ClientOnly>
        {children}
        <div className="inline-div">This is an inline styled div</div>
        <React.Suspense fallback={null}>
          <RouterDevtools position="bottom-right" />
        </React.Suspense>
        <script src="/before-scripts-script.js" />
        <script src="/before-scripts-async-script.js" async={true} />
        <Scripts />
        <script src="/user-script.js" />
        <script src="/async-user-script.js" async={true} />
      </body>
    </html>
  )
}
