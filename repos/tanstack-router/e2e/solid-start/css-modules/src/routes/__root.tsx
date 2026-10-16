import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/solid-router'
import { HydrationScript } from 'solid-js/web'

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
        <HydrationScript />
        <HeadContent />
      </head>
      <body>
        <nav
          data-testid="main-nav"
          style={{
            padding: '12px 20px',
            'border-bottom': '1px solid #e2e8f0',
            display: 'flex',
            'align-items': 'center',
            gap: '16px',
            'background-color': '#fff',
          }}
        >
          <Link
            to="/"
            style={{ color: '#0284c7', 'text-decoration': 'none' }}
            data-testid="nav-home"
          >
            Home (Global CSS)
          </Link>
          <Link
            to="/modules"
            style={{ color: '#0284c7', 'text-decoration': 'none' }}
            data-testid="nav-modules"
          >
            CSS Modules
          </Link>
          <Link
            to="/sass-mixin"
            style={{ color: '#0284c7', 'text-decoration': 'none' }}
            data-testid="nav-sass-mixin"
          >
            Sass Mixin
          </Link>
        </nav>

        <main style={{ padding: '20px' }}>
          <Outlet />
        </main>
        <Scripts />
      </body>
    </html>
  )
}
