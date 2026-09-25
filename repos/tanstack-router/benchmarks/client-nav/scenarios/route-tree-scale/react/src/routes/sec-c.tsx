import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-c')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
