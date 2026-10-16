import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/foo/$bar/$qux/_here/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>OK you got me</div>
}
