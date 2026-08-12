import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/_layout')({
  component: Layout,
})

function Layout() {
  return <Outlet />
}
