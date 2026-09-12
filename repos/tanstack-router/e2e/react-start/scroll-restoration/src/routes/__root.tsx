/// <reference types="vite/client" />
import * as React from 'react'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  linkOptions,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { DefaultCatchBoundary } from '~/components/DefaultCatchBoundary'
import { NotFound } from '~/components/NotFound'
import appCss from '~/styles/app.css?url'
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
      <TanStackRouterDevtools />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <Nav type="header" />
        <hr />
        {children}
        <hr />
        <Nav type="footer" />
        <Scripts />
      </body>
    </html>
  )
}

function Nav({ type }: { type: 'header' | 'footer' }) {
  const Elem = type === 'header' ? 'header' : 'footer'
  const prefix = type === 'header' ? 'Head' : 'Foot'
  return (
    <Elem className="p-2 flex gap-2 text-lg">
      <Link
        to="/"
        activeProps={{
          className: 'font-bold',
        }}
        activeOptions={{ exact: true }}
      >
        {prefix}-/
      </Link>{' '}
      {(
        [
          linkOptions({ to: '/normal-page' }),
          linkOptions({ to: '/with-loader' }),
          linkOptions({ to: '/with-search', search: { where: type } }),
          linkOptions({ to: '/hash-scroll-repro' }),
        ] as const
      ).map((options, i) => (
        <Link
          key={`${prefix}-${options.to}-${i}`}
          {...options}
          activeProps={{
            className: 'font-bold',
          }}
        >
          {prefix}-{options.to}
        </Link>
      ))}
    </Elem>
  )
}
