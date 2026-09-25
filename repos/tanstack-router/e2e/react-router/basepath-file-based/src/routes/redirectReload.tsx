import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/redirectReload')({
  beforeLoad: () => {
    throw redirect({ to: '/about', reloadDocument: true })
  },
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/redirectReload"!</div>
}
