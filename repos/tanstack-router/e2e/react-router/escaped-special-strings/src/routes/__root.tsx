import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div>
        <p data-testid="not-found">Page not found</p>
        <Link to="/index">Go to /index</Link>
      </div>
    )
  },
})

function RootComponent() {
  return (
    <div>
      <h1>Escaped Special Strings Test</h1>
      <nav
        style={{
          display: 'flex',
          gap: '1rem',
          padding: '1rem',
          borderBottom: '1px solid #ccc',
        }}
      >
        <Link to="/" data-testid="link-home">
          / (home)
        </Link>
        <Link to="/index" data-testid="link-index">
          /index
        </Link>
        <Link to="/route" data-testid="link-route">
          /route
        </Link>
        <Link to="/lazy" data-testid="link-lazy">
          /lazy
        </Link>
        <Link to="/_layout" data-testid="link-underscore-layout">
          /_layout
        </Link>
        <Link to="/blog_" data-testid="link-blog-underscore">
          /blog_
        </Link>
      </nav>
      <main style={{ padding: '1rem' }}>
        <Outlet />
      </main>
    </div>
  )
}
