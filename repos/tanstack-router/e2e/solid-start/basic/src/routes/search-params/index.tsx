import { Link, createFileRoute } from '@tanstack/solid-router'

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
    </div>
  )
}
