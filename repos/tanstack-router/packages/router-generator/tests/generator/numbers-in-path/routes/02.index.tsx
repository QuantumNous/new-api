import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/02/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/02/"!</div>
}
