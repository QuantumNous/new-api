import { Link, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/redirect/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div class="p-2 flex gap-2">
      <Link to="/redirect/throw-it">
        <div data-testid="link-to-throw-it">Throw It</div>
      </Link>
    </div>
  )
}
