import { createFileRoute } from '@tanstack/react-router'
import { Link } from '@tanstack/react-router'

export const Route = createFileRoute('/redirect/preload/first')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div data-testid="first">
      <Link
        from={Route.fullPath}
        to="../second"
        activeProps={{
          className: 'font-bold',
        }}
        preload="intent"
        data-testid={'link'}
      >
        go to second
      </Link>
    </div>
  )
}
