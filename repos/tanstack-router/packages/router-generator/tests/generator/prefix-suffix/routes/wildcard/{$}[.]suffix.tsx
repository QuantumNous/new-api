import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/wildcard/{$}.suffix')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/wildcard/.suffix"!</div>
}
