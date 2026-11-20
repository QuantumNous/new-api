import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { getRouterInstance } from '@tanstack/react-start'
import axios from 'redaxios'

import type { User } from '~/utils/users'

export const Route = createFileRoute('/users')({
  loader: async () => {
    const router = await getRouterInstance()
    return await axios
      .get<Array<User>>('/api/users', { baseURL: router.options.origin })
      .then((r) => r.data)
      .catch(() => {
        throw new Error('Failed to fetch users')
      })
  },
  component: UsersComponent,
})

function UsersComponent() {
  const users = Route.useLoaderData()

  return (
    <div className="p-2 flex gap-2">
      <ul className="list-disc pl-4">
        {[
          ...users,
          { id: 'i-do-not-exist', name: 'Non-existent User', email: '' },
        ].map((user) => {
          return (
            <li key={user.id} className="whitespace-nowrap">
              <Link
                to="/users/$userId"
                params={{
                  userId: String(user.id),
                }}
                className="block py-1 text-blue-800 hover:text-blue-600"
                activeProps={{ className: 'text-black font-bold' }}
              >
                <div>{user.name}</div>
              </Link>
            </li>
          )
        })}
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
