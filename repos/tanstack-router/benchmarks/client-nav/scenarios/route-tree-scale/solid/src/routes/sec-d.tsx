import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-d')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
