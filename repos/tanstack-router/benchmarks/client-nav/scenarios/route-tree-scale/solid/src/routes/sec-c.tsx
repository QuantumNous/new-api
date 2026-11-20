import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-c')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
