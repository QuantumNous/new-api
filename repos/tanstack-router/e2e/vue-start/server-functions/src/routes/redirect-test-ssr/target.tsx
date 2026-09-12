import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/redirect-test-ssr/target')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div>
      <h1 data-testid="redirect-target-ssr">Redirect Target SSR</h1>
      <p>Successfully redirected!</p>
    </div>
  )
}
