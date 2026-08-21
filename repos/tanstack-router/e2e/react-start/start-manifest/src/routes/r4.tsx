import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/r4')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <section>
      <h1>Route /r4</h1>
      <p>Auxiliary route.</p>
    </section>
  )
}
