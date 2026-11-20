import {
  Body,
  HeadContent,
  Html,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
  linkOptions,
} from '@tanstack/vue-router'
import { TanStackRouterDevtools } from '@tanstack/vue-router-devtools'
import { NotFound } from '~/components/NotFound'
import appCss from '~/styles/app.css?url'
import { seo } from '~/utils/seo'

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
      ...seo({
        title:
          'TanStack Start | Type-Safe, Client-First, Full-Stack Vue Framework',
        description: `TanStack Start is a type-safe, client-first, full-stack Vue framework. `,
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
    return <p>{props.error.stack}</p>
  },
  notFoundComponent: () => <NotFound />,
  component: RootComponent,
})

function RootComponent() {
  return (
    <Html>
      <head>
        <HeadContent />
      </head>
      <Body>
        <Nav type="header" />
        <hr />
        <Outlet />
        <hr />
        <Nav type="footer" />
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </Body>
    </Html>
  )
}

function Nav({ type }: { type: 'header' | 'footer' }) {
  const prefix = type === 'header' ? 'Head' : 'Foot'
  const optionsList = [
    linkOptions({ to: '/normal-page' }),
    linkOptions({ to: '/with-loader' }),
    linkOptions({ to: '/with-search', search: { where: type } }),
  ] as const

  const content = (
    <>
      <Link
        to="/"
        activeProps={{
          class: 'font-bold',
        }}
        activeOptions={{ exact: true }}
      >
        {prefix}-/
      </Link>{' '}
      {optionsList.map((options, i) => (
        <Link
          key={i}
          {...options}
          activeProps={{
            class: 'font-bold',
          }}
        >
          {prefix}-{options.to}
        </Link>
      ))}
    </>
  )

  return type === 'header' ? (
    <header class="p-2 flex gap-2 text-lg">{content}</header>
  ) : (
    <footer class="p-2 flex gap-2 text-lg">{content}</footer>
  )
}
