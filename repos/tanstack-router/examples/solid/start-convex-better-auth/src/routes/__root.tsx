/// <reference types="vite/client" />
import { HeadContent, Scripts, createRootRoute } from '@tanstack/solid-router'
import { HydrationScript, Suspense } from 'solid-js/web'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import type * as Solid from 'solid-js'
import appCss from '~/styles/app.css?url'
import AppConvexProvider from '~/providers/convex'
import { fetchAuth } from '~/library/server'

export const Route = createRootRoute({
  head: () => ({
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  beforeLoad: async () => {
    const { session, token } = await fetchAuth()
    return { session, token }
  },
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
        <Suspense>
          <AppConvexProvider>{props.children}</AppConvexProvider>
        </Suspense>
        <TanStackRouterDevtools position="bottom-right" />
        <Scripts />
      </body>
    </html>
  )
}
