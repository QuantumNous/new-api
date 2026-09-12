import { createFileRoute } from '@tanstack/solid-router'
import { NotFound } from '../components/NotFound'
import { UserErrorComponent } from '../components/UserError'

export const Route = createFileRoute('/users/$userId')({
  loader: async ({ params: { userId } }) => {
    try {
      const res = await fetch('/api/users/' + userId)
      if (!res.ok) {
        throw new Error('Unexpected status code')
      }

      const data = await res.json()

      return data
    } catch {
      throw new Error('Failed to fetch user')
    }
  },
  errorComponent: UserErrorComponent,
  component: UserComponent,
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>
  },
})

function UserComponent() {
  const user = Route.useLoaderData()

  return (
    <div class="space-y-2">
      <h4 class="text-xl font-bold underline">{user().name}</h4>
      <div class="text-sm">{user().email}</div>
      <div>
        <a
          href={`/api/users/${user().id}`}
          class="text-blue-800 hover:text-blue-600 underline"
        >
          View as JSON
        </a>
      </div>
    </div>
  )
}
