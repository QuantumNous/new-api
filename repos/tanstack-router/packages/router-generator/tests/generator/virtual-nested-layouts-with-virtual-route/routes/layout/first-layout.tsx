import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_first')({
  component: () => (
    <div>
      <div>First Layout</div>
      <Outlet />
    </div>
  ),
})
