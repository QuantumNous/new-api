import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/middleware/redirect-with-middleware/target',
)({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="p-4">
      <h1 data-testid="middleware-redirect-target">
        Redirect Target (Middleware)
      </h1>
      <p className="mt-2">
        Successfully redirected! Middleware did not cause serialization error.
      </p>
    </div>
  )
}
