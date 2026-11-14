import { Link, Outlet, createRootRoute } from '@tanstack/solid-router'
import { leafParamSets, midParams } from '../../../shared'

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <nav>
        <Link to="/" data-testid="home">
          Home
        </Link>
        <Link
          to="/l/$a/$b/$c/$d/$e/$f/$g/$h"
          params={leafParamSets[0]!}
          data-testid="leaf-1"
        >
          Leaf 1
        </Link>
        <Link
          to="/l/$a/$b/$c/$d/$e/$f/$g/$h"
          params={leafParamSets[1]!}
          data-testid="leaf-2"
        >
          Leaf 2
        </Link>
        <Link
          to="/l/$a/$b/$c/$d/$e/$f/$g/$h"
          params={leafParamSets[2]!}
          data-testid="leaf-3"
        >
          Leaf 3
        </Link>
        <Link
          to="/l/$a/$b/$c/$d/$e/$f/$g/$h"
          params={leafParamSets[3]!}
          data-testid="leaf-4"
        >
          Leaf 4
        </Link>
        <Link to="/l/$a/$b/$c/$d" params={midParams} data-testid="mid-4">
          Mid 4
        </Link>
      </nav>
      <Outlet />
    </>
  )
}
