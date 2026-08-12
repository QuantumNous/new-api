import {
  Link,
  Outlet,
  createRootRoute,
  useLocation,
} from '@tanstack/solid-router'

export const Route = createRootRoute({
  component: RootComponent,
})

function LocationMarker() {
  const pathname = useLocation({ select: (location) => location.pathname })
  return <span data-testid="loc">{pathname()}</span>
}

function RootComponent() {
  return (
    <>
      <LocationMarker />
      <nav>
        <Link to="/" data-testid="home">
          Home
        </Link>
        <Link to="/hop1" data-testid="go-hop1">
          Redirect chain
        </Link>
        <Link
          to="/missing/$id"
          params={{ id: 'exists' }}
          data-testid="go-missing-ok"
        >
          Missing ok
        </Link>
        <Link
          to="/missing/$id"
          params={{ id: 'gone' }}
          data-testid="go-missing-gone"
        >
          Missing gone
        </Link>
        <Link to="/broken" data-testid="go-broken">
          Broken
        </Link>
        <Link to="/target" data-testid="go-target">
          Target
        </Link>
      </nav>
      <Outlet />
    </>
  )
}
