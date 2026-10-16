import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/non-nested')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <h3 className="pb-2" data-testid="non-nested-path-heading">
        Non-nested paths
      </h3>
      <ul className="grid mb-2">
        <li>
          <Link from={Route.fullPath} data-testid="l-to-named" to="./named">
            To named param tests
          </Link>
          <Link from={Route.fullPath} data-testid="l-to-prefix" to="./prefix">
            To prefix param tests
          </Link>
          <Link from={Route.fullPath} data-testid="l-to-suffix" to="./suffix">
            To suffix param tests
          </Link>
          <Link from={Route.fullPath} data-testid="l-to-path" to="./path">
            To path tests
          </Link>
        </li>
      </ul>
      <Outlet />
    </div>
  )
}
