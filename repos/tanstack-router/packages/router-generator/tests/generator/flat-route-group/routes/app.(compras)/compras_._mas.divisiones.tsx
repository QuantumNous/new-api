import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/(compras)/compras_/_mas/divisiones')(
  {
    component: RouteComponent,
  },
)

function RouteComponent() {
  return <div>Hello "/app/(compras)/compras/_mas/divisiones"!</div>
}
