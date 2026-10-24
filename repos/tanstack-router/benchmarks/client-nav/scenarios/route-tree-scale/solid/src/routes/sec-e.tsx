import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/sec-e')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
