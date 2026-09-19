import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/redirect-test/target')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <h1 data-testid="redirect-target">Redirect Target</h1>
      <p>Successfully redirected!</p>
    </div>
  )
}
