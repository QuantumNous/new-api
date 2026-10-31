import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-d')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
