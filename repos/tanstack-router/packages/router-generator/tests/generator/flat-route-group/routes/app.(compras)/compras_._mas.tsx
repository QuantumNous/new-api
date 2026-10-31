import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/(compras)/compras_/_mas')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/app/(compras)/compras/mas"!</div>
}
