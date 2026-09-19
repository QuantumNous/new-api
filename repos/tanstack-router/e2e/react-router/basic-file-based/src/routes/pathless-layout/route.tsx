import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/pathless-layout')({
  component: () => (
    <div>
      <h2 data-testid="pathless-layout-header">Pathless Layout Section</h2>
      <Outlet />
    </div>
  ),
  notFoundComponent: () => (
    <div data-testid="pathless-layout-not-found">
      Not Found in Pathless Layout
    </div>
  ),
})
