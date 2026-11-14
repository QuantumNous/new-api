import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-f')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
