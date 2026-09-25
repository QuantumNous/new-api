import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/solid-router'
import { Suspense } from 'solid-js'
import { HydrationScript } from 'solid-js/web'

export const Route = createRootRouteWithContext()({
  head: () => ({ meta: [{ charset: 'utf-8' }] }),
  shellComponent: RootDocument,
})

function RootDocument() {
  return (
    <html>
      <head>
        <HydrationScript />
      </head>
      <body>
        <HeadContent />
        <nav>
          <Link to="/">Home</Link> <Link to="/layout/page2">👉 To page2</Link>
        </nav>
        <Suspense>
          <Outlet />
        </Suspense>
        <Scripts />
      </body>
    </html>
  )
}
