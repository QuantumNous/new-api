import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/fullpath-test')({
  component: () => (
    <div>
      <h2 data-testid="fullpath-test-header">FullPath Test Section</h2>
      <Outlet />
    </div>
  ),
})
