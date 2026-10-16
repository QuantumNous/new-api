import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/03')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/03"!</div>
}
