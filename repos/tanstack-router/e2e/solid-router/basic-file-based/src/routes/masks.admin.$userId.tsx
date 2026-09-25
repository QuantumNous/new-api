import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/masks/admin/$userId')({
  component: AdminUserRoute,
})

function AdminUserRoute() {
  const params = Route.useParams()

  return (
    <div data-testid="admin-user-component">
      <div data-testid="admin-user-id">{params().userId}</div>
    </div>
  )
}
