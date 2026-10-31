import { Link, Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootComponent,
})

const ids = ['1', '2']

function RootComponent() {
  return (
    <>
      <nav>
        <Link to="/" data-testid="go-home">
          Home
        </Link>
        {ids.map((id) => (
          <Link
            key={id}
            to="/slow/$id"
            params={{ id }}
            data-testid={`go-slow-${id}`}
          >
            {`Slow ${id}`}
          </Link>
        ))}
        {ids.map((id) => (
          <Link
            key={id}
            to="/ctx/$id"
            params={{ id }}
            data-testid={`go-ctx-${id}`}
          >
            {`Ctx ${id}`}
          </Link>
        ))}
        {ids.map((id) => (
          <Link
            key={id}
            to="/nested/$id"
            params={{ id }}
            data-testid={`go-nested-${id}`}
          >
            {`Nested ${id}`}
          </Link>
        ))}
      </nav>
      <Outlet />
    </>
  )
}
