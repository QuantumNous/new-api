import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-f')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
