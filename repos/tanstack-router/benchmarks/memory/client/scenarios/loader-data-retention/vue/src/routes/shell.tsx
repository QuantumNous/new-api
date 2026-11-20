import { Outlet, createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/shell')({
  component: ShellComponent,
})

function ShellComponent() {
  return <Outlet />
}
