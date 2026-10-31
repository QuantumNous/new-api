import { Link, Outlet } from '@tanstack/react-router'
import { Route as childRoute } from '../routes/aliased-route-imports.$id.child'
import { Route } from '../routes/aliased-route-imports.$id'

export function AliasedRouteImportParentPanel() {
  const { id } = Route.useParams()

  return (
    <main className="hmr-card flex flex-col gap-4">
      <p className="hmr-marker" data-testid="aliased-parent-marker">
        aliased-parent-baseline
      </p>
      <Link
        className="hmr-button w-fit"
        data-testid="aliased-show-child"
        params={{ id }}
        to={childRoute.to}
      >
        Show aliased child {id}
      </Link>
      <Outlet />
    </main>
  )
}
