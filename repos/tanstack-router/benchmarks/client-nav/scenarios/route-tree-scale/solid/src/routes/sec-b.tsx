import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-b')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
