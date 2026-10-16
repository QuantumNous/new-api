import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sec-e')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
