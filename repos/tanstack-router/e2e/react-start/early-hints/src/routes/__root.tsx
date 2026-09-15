import * as React from 'react'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.ico' },
      { rel: 'preconnect', href: 'https://early-hints.test' },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <nav style={{ padding: '10px', display: 'flex', gap: '10px' }}>
          <Link to="/">Home</Link>
          <Link to="/parent">Parent</Link>
          <Link to="/parent/child">Parent/Child</Link>
          <Link to="/parent/child/grandchild">Parent/Child/Grandchild</Link>
          <Link to="/other">Other</Link>
          <Link to="/other/nested">Other/Nested</Link>
        </nav>
        <hr />
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
