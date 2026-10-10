import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/specialChars')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div>Hello "/specialChars"!</div>
      <Link
        to="/specialChars/대한민국"
        activeProps={{
          className: 'font-bold',
        }}
        data-testid="special-non-latin-link"
      >
        Unicode
      </Link>{' '}
      <Link
        to="/specialChars/$param"
        activeProps={{
          className: 'font-bold',
        }}
        data-testid="special-param-link"
        params={{ param: '대|' }}
      >
        Unicode param
      </Link>{' '}
      <Link
        to="/specialChars/search"
        activeProps={{
          className: 'font-bold',
        }}
        data-testid="special-searchParam-link"
        search={{ searchParam: '대|' }}
      >
        Unicode search param
      </Link>{' '}
      <Link
        to="/specialChars/hash"
        activeOptions={{
          includeHash: true,
        }}
        activeProps={{
          className: 'font-bold',
        }}
        hash={'대|'}
        data-testid="special-hash-link-1"
      >
        Unicode Hash 대|
      </Link>{' '}
      <Link
        to="/specialChars/hash"
        activeOptions={{
          includeHash: true,
        }}
        activeProps={{
          className: 'font-bold',
        }}
        hash={'abc'}
        data-testid="special-hash-link-2"
      >
        Unicode Hash abc
      </Link>{' '}
      <Link
        to="/specialChars/malformed"
        activeProps={{
          className: 'font-bold',
        }}
        data-testid="special-malformed-link"
      >
        Malformed paths
      </Link>{' '}
      <hr />
      <Outlet />
    </div>
  )
}
