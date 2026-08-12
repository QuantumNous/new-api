import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <nav>
        <Link to="/" activeProps={{ className: 'active' }}>
          Home
        </Link>
        <Link to="/shop" activeProps={{ className: 'active' }}>
          Shop
        </Link>
        <Link
          to="/shop/$productId"
          params={{ productId: '1' }}
          activeProps={{ className: 'active' }}
        >
          Product 1
        </Link>
        <Link to="/blog" activeProps={{ className: 'active' }}>
          Blog
        </Link>
        <Link
          to="/search"
          search={{ q: '', page: 1 }}
          activeProps={{ className: 'active' }}
        >
          Search
        </Link>
        <Link to="/about" activeProps={{ className: 'active' }}>
          About
        </Link>
      </nav>
      <Outlet />
    </>
  )
}
