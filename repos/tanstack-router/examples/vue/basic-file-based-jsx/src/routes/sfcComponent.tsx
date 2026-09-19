import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/sfcComponent')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Will be overwritten by the SFC component!</div>
}
