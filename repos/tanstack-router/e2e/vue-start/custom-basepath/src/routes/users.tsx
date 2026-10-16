import { Link, Outlet, createFileRoute } from '@tanstack/vue-router'
import axios from 'redaxios'
import type { User } from '~/utils/users'
import { basepath } from '~/utils/basepath'

export const Route = createFileRoute('/users')({
  loader: async () => {
    return await axios
      .get<Array<User>>(basepath + '/api/users')
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
    <div class="p-2 flex gap-2">
      <ul class="list-disc pl-4">
        {[
          ...users.value,
          { id: 'i-do-not-exist', name: 'Non-existent User', email: '' },
        ].map((user) => (
          <li class="whitespace-nowrap" key={user.id}>
            <Link
              to="/users/$userId"
              params={{
                userId: String(user.id),
              }}
              class="block py-1 text-blue-800 hover:text-blue-600"
              activeProps={{ class: 'text-black font-bold' }}
            >
              <div>{user.name}</div>
            </Link>
          </li>
        ))}
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
