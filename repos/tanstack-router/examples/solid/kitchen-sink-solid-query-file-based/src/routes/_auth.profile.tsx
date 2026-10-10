import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/_auth/profile')({
  component: ProfileComponent,
})

function ProfileComponent() {
  const routeContext = Route.useRouteContext()

  return (
    <div class="p-2 space-y-2">
      <div>
        Username:<strong>{routeContext().username}</strong>
      </div>
    </div>
  )
}
