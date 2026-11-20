import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-a')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
