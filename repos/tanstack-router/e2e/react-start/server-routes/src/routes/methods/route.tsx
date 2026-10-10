import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/methods')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="p-8">
      <h1 className="font-bold text-lg">Server Routes Methods E2E tests</h1>
      <Outlet />
    </div>
  )
}
