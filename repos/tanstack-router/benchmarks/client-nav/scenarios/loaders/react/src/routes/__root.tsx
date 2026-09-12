import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <nav>
        <Link
          to="/"
          data-testid="go-home"
          activeProps={{ className: 'active' }}
        >
          Home
        </Link>
        <Link
          to="/fresh/$id"
          params={{ id: '1' }}
          data-testid="go-fresh-1"
          activeProps={{ className: 'active' }}
        >
          Fresh 1
        </Link>
        <Link
          to="/fresh/$id"
          params={{ id: '2' }}
          data-testid="go-fresh-2"
          activeProps={{ className: 'active' }}
        >
          Fresh 2
        </Link>
        <Link
          to="/cached/$id"
          params={{ id: '1' }}
          data-testid="go-cached-1"
          activeProps={{ className: 'active' }}
        >
          Cached 1
        </Link>
        <Link
          to="/cached/$id"
          params={{ id: '2' }}
          data-testid="go-cached-2"
          activeProps={{ className: 'active' }}
        >
          Cached 2
        </Link>
        <Link
          to="/deps"
          search={{ page: 1 }}
          data-testid="go-deps-1"
          activeOptions={{ includeSearch: true }}
        >
          Deps page 1
        </Link>
        <Link
          to="/deps"
          search={{ page: 2 }}
          data-testid="go-deps-2"
          activeOptions={{ includeSearch: true }}
        >
          Deps page 2
        </Link>
      </nav>
      <Outlet />
    </>
  )
}
