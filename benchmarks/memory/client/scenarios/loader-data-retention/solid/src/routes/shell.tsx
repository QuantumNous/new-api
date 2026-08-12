import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/shell')({
  component: ShellComponent,
})

function ShellComponent() {
  return <Outlet />
}
