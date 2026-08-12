import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/wildcard/prefix{$}')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/wildcard/prefix"!</div>
}
