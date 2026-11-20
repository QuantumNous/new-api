import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/shell')({
  component: ShellComponent,
})

function ShellComponent() {
  return <Outlet />
}
