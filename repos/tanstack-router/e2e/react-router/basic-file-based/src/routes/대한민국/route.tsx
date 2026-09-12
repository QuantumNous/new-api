import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/대한민국')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <h3 className="pb-2" data-testid="unicode-heading">
        Hello "/대한민국"!
      </h3>
      <ul className="grid mb-2">
        <li>
          <Link
            data-testid="l-to-named-latin"
            from={Route.fullPath}
            to="./🚀/$id"
            params={{ id: 'foo' }}
            activeProps={{ className: 'font-bold' }}
          >
            link to latin id
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-named-unicode"
            from={Route.fullPath}
            to="./🚀/$id"
            params={{ id: 'foo%\\/🚀대' }}
            activeProps={{ className: 'font-bold' }}
          >
            link to unicode id
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-wildcard-latin"
            from={Route.fullPath}
            to="./wildcard/$"
            params={{ _splat: 'foo/bar' }}
            activeProps={{ className: 'font-bold' }}
          >
            link to foo/bar
          </Link>
        </li>
        <li>
          <Link
            data-testid="l-to-wildcard-unicode"
            from={Route.fullPath}
            to="./wildcard/$"
            params={{ _splat: 'foo%\\/🚀대' }}
            activeProps={{ className: 'font-bold' }}
          >
            link to foo%\/🚀대
          </Link>
        </li>
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
