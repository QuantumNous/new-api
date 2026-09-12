import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-b')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
