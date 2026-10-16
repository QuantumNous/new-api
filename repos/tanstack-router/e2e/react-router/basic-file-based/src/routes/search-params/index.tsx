import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/search-params/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <Link
        data-testid="link-to-default-without-search"
        to="/search-params/default"
      >
        go to /search-params/default
      </Link>
      <br />
      <Link
        data-testid="link-to-default-with-search"
        to="/search-params/default"
        search={{ default: 'd2' }}
      >
        go to /search-params/default?default=d2
      </Link>
      <br />
      <Link
        data-testid="link-to-default-with-search-special-characters"
        to="/search-params/default"
        search={{ default: '🚀대한민국' }}
      >
        go to /search-params/default?default=🚀대한민국
      </Link>
      <br />
      <Link
        data-testid="link-to-default-with-search-encoded-characters"
        to="/search-params/default"
        search={{ default: '%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD' }}
      >
        go to
        /search-params/default?default=%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD
      </Link>
    </div>
  )
}
