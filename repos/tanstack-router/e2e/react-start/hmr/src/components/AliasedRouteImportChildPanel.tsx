import { Link } from '@tanstack/react-router'
import { Route as parentRoute } from '../routes/aliased-route-imports.$id'
import { Route } from '../routes/aliased-route-imports.$id.child'

export function AliasedRouteImportChildPanel() {
  const { id } = Route.useParams()

  return (
    <main className="hmr-card flex flex-col gap-4">
      <p className="hmr-marker" data-testid="aliased-child-marker">
        aliased-child-baseline
      </p>
      <Link
        className="hmr-button w-fit"
        data-testid="aliased-back-parent"
        params={{ id }}
        to={parentRoute.to}
      >
        Back to aliased parent {id}
      </Link>
    </main>
  )
}
