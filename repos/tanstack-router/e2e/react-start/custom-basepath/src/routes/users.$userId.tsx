import { ErrorComponent, createFileRoute } from '@tanstack/react-router'
import axios from 'redaxios'
import type { ErrorComponentProps } from '@tanstack/react-router'

import type { User } from '~/utils/users'
import { NotFound } from '~/components/NotFound'
import { basepath } from '~/utils/basepath'

export const Route = createFileRoute('/users/$userId')({
  loader: async ({ params: { userId } }) => {
    return await axios
      .get<User>(basepath + '/api/users/' + userId)
      .then((r) => r.data)
      .catch(() => {
        throw new Error('Failed to fetch user')
      })
  },
  errorComponent: UserErrorComponent,
  component: UserComponent,
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>
  },
})

function UserErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}

function UserComponent() {
  const user = Route.useLoaderData()

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{user.name}</h4>
      <div className="text-sm">{user.email}</div>
    </div>
  )
}
