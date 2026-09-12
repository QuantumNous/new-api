import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/not-found/parent-boundary/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./via-beforeLoad"
          data-testid="parent-boundary-via-beforeLoad-with-routeId"
        >
          via-beforeLoad (with routeId)
        </Link>
      </div>
      <div className="mb-2">
        <Link
          from={Route.fullPath}
          to="./via-beforeLoad"
          search={{ target: 'none' }}
          data-testid="parent-boundary-via-beforeLoad-without-routeId"
        >
          via-beforeLoad (without routeId)
        </Link>
      </div>
    </div>
  )
}
