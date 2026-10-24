import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/r5')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <section>
      <h1>Route /r5</h1>
      <p>Auxiliary route.</p>
    </section>
  )
}
