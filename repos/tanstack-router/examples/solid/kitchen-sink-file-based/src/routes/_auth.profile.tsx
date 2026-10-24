import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'

export const Route = createFileRoute('/_auth/profile')({
  component: ProfileComponent,
})

function ProfileComponent() {
  const context = Route.useRouteContext()

  return (
    <div class="p-2 space-y-2">
      <div>
        Username:<strong>{context().username}</strong>
      </div>
    </div>
  )
}
