import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/middleware/')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div class="p-8">
      <h1 class="font-bold text-lg">Server functions middleware E2E tests</h1>
      <ul class="list-disc p-4">
        <li>
          <Route.Link
            to="./client-middleware-router"
            data-testid="client-middleware-router-link"
          >
            Client Middleware has access to router instance
          </Route.Link>
        </li>
        <li>
          <Route.Link to="./send-serverFn" data-testid="send-serverFn-link">
            Client Middleware can send server function reference in context
          </Route.Link>
        </li>
        <li>
          <Route.Link
            to="./request-middleware"
            data-testid="request-middleware-link"
            reloadDocument={true}
          >
            Request Middleware in combination with server function
          </Route.Link>
        </li>
      </ul>
    </div>
  )
}
