import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import type { User } from '~/utils/users'

export const Route = createFileRoute('/users')({
  loader: async () => {
    const res = await fetch('/api/users')

    if (!res.ok) {
      throw new Error('Unexpected status code')
    }

    const data = await res.json()

    return data as Array<User>
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
