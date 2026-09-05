import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/redirect')({
  beforeLoad: () => {
    throw redirect({ to: '/about' })
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/redirect"!</div>
}
