import {
  Link,
  Outlet,
  createRootRoute,
  useLocation,
} from '@tanstack/react-router'
import type { SearchSchemaInput } from '@tanstack/react-router'

export const Route = createRootRoute({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
    ({
      _locale: typeof search._locale === 'string' ? search._locale : undefined,
    }) as { _locale?: string },
  component: RootComponent,
})

function RootComponent() {
  const pathname = useLocation({ select: (location) => location.pathname })

  return (
    <>
      <nav>
        <span data-testid="loc">{pathname}</span>
        <Link to="/" data-testid="go-home">
          Home
        </Link>
        <Link to="/p/$a" params={{ a: 'x' }} data-testid="go-x">
          Section x
        </Link>
        <Link
          to="/p/$a/$b"
          params={{ a: 'x', b: '1' }}
          search={{ _locale: 'fr' }}
          data-testid="go-x-1-fr"
        >
          Item x/1 (fr)
        </Link>
        <Link
          to="/p/$a"
          params={{ a: 'y' }}
          search={{ _locale: 'de' }}
          data-testid="go-y-de"
        >
          Section y (de)
        </Link>
        <Link to="/p/$a/$b" params={{ a: 'y', b: '2' }} data-testid="go-y-2">
          Item y/2
        </Link>
        <Link
          to="/p/$a"
          params={{ a: 'x' }}
          search={{ _locale: 'es' }}
          data-testid="go-x-es"
        >
          Section x (es)
        </Link>
      </nav>
      <Outlet />
    </>
  )
}
