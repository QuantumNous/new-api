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
        <nav
          data-testid="main-nav"
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            backgroundColor: '#fff',
          }}
        >
          <Link
            to="/"
            style={{ color: '#0284c7', textDecoration: 'none' }}
            data-testid="nav-home"
          >
            Home (Global CSS)
          </Link>
          <Link
            to="/modules"
            style={{ color: '#0284c7', textDecoration: 'none' }}
            data-testid="nav-modules"
          >
            CSS Modules
          </Link>
          <Link
            to="/sass-mixin"
            style={{ color: '#0284c7', textDecoration: 'none' }}
            data-testid="nav-sass-mixin"
          >
            Sass Mixin
          </Link>
          <Link
            to="/quotes"
            style={{ color: '#0284c7', textDecoration: 'none' }}
            data-testid="nav-quotes"
          >
            Quoted CSS
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
