import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'
import axios from 'redaxios'
import { createServerFn } from '@tanstack/solid-start'
import type { User } from '../utils/users'
import { staticFunctionMiddleware } from '@tanstack/start-static-server-functions'

const fetchUsers = createServerFn({ method: 'GET' })
  .middleware([staticFunctionMiddleware])
  .handler(async () => {
    console.info('Fetching users...')
    const res = await axios.get<Array<User>>(
      'https://jsonplaceholder.typicode.com/users',
    )

    return res.data
      .slice(0, 10)
      .map((u) => ({ id: u.id, name: u.name, email: u.email }))
  })

export const Route = createFileRoute('/users')({
  loader: async () => fetchUsers(),
  component: UsersComponent,
})

function UsersComponent() {
  const users = Route.useLoaderData()

  return (
    <div class="p-2 flex gap-2">
      <ul class="list-disc pl-4">
        {[
          ...users(),
          { id: 'i-do-not-exist', name: 'Non-existent User', email: '' },
        ].map((user) => {
          return (
            <li class="whitespace-nowrap">
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
          )
        })}
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
