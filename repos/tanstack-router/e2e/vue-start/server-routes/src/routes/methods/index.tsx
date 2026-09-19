import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/methods/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div class="p-8">
      <ul class="list-disc p-4">
        <li>
          <Route.Link to="./only-any">
            Server Route only has ANY handler
          </Route.Link>
        </li>
      </ul>
    </div>
  )
}
