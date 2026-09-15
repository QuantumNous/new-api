import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/(compras)/compras_/ordenes')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/app/(compras)/compras/mas/divisiones"!</div>
}
