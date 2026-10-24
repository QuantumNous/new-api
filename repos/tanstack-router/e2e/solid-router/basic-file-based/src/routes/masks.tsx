import {
  Link,
  Outlet,
  createFileRoute,
  useRouterState,
} from '@tanstack/solid-router'

export const Route = createFileRoute('/masks')({
  component: MasksLayout,
})

function MasksLayout() {
  const location = useRouterState({
    select: (state) => state.location,
  })

  return (
    <div>
      <h2>Route Masks</h2>
      <nav>
        <Link
          to="/masks/admin/$userId"
          params={{ userId: '42' }}
          data-testid="link-to-admin-mask"
        >
          Go to admin user
        </Link>
      </nav>
      <div>
        <div data-testid="router-pathname">{location().pathname}</div>
        <div data-testid="router-masked-pathname">
          {location().maskedLocation?.pathname ?? ''}
        </div>
      </div>
      <Outlet />
    </div>
  )
}
