import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/dashboard')({
  component: () => (
    <div>
      <h1>Dashboard Layout</h1>
      <Outlet />
    </div>
  ),
})
