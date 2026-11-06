import { ErrorComponent, createFileRoute } from '@tanstack/react-router'
import axios from 'redaxios'
import { createServerFn } from '@tanstack/react-start'
import type { ErrorComponentProps } from '@tanstack/react-router'
import type { User } from '~/utils/users'
import { NotFound } from '~/components/NotFound'
import { staticFunctionMiddleware } from '@tanstack/start-static-server-functions'

const fetchUser = createServerFn({ method: 'GET' })
  .middleware([staticFunctionMiddleware])
  .validator((d: string) => d)
  .handler(async ({ data: userId }) => {
    return axios
      .get<User>('https://jsonplaceholder.typicode.com/users/' + userId)
      .then((d) => ({
        id: d.data.id,
        name: d.data.name,
        email: d.data.email,
      }))
      .catch((e) => {
        throw new Error('Failed to fetch user')
      })
  })

export const Route = createFileRoute('/users/$userId')({
  loader: ({ params: { userId } }) => fetchUser({ data: userId }),
  errorComponent: UserErrorComponent,
  component: UserComponent,
  notFoundComponent: () => {
    return <NotFound>User not found</NotFound>
  },
})

export function UserErrorComponent({ error }: ErrorComponentProps) {
  return <ErrorComponent error={error} />
}

function UserComponent() {
  const user = Route.useLoaderData()

  if ('error' in user) {
    return <NotFound>User not found</NotFound>
  }

  return (
    <div className="space-y-2">
      <h4 className="text-xl font-bold underline">{user.name}</h4>
      <div className="text-sm">{user.email}</div>
    </div>
  )
}
