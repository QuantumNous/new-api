/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Scripts,
  createRootRoute,
} from '@tanstack/solid-router'
import { HydrationScript } from 'solid-js/web'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import type * as Solid from 'solid-js'
import appCss from '~/styles/app.css?url'

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument(props: { children: Solid.JSX.Element }) {
  return (
    <html>
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        <div>
          <Link to="/">Index</Link>
          <Link to="/about">About</Link>
        </div>
        {props.children}
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
