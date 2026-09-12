/// <reference types="vite/client" />
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'

import '../styles/app.css'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
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
        <nav>
          <Link
            to="/"
            activeProps={{ className: 'active' }}
            activeOptions={{ exact: true }}
            data-testid="link-home"
          >
            Home
          </Link>{' '}
          <Link
            to="/about"
            activeProps={{ className: 'active' }}
            data-testid="link-about"
          >
            About
          </Link>
        </nav>
        <hr />
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
