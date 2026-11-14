import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/wildcard/$')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/wildcard/$"!</div>
}
