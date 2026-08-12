import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/feature')({
  component: () => (
    <div>
      <h1>Feature Layout</h1>
      <Outlet />
    </div>
  ),
})
