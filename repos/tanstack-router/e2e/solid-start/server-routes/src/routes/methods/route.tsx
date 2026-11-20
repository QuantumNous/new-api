import { Outlet, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/methods')({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div class="p-8">
      <h1 class="font-bold text-lg">Server Routes Methods E2E tests</h1>
      <Outlet />
    </div>
  )
}
