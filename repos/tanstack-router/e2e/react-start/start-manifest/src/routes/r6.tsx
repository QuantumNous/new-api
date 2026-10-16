import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/r6')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <section>
      <h1>Route /r6</h1>
      <p>Auxiliary route.</p>
    </section>
  )
}
