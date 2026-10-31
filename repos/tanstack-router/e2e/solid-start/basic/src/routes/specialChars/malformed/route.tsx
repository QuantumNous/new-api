import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/specialChars/malformed')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div>Hello "/specialChars/malformed"!</div>
      <Link
        from={Route.fullPath}
        data-testid="special-malformed-path-link"
        href="/specialChars/malformed/%E0%A4"
      >
        malformed path param
      </Link>{' '}
      <Link
        from={Route.fullPath}
        data-testid="special-malformed-search-link"
        href="/specialChars/malformed/search?searchParam=%E0%A4"
      >
        malformed search param
      </Link>{' '}
      <hr />
      <Outlet />
    </div>
  )
}
