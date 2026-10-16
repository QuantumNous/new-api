import { useQuery } from '@tanstack/vue-query'
import { Link, Outlet, createFileRoute } from '@tanstack/vue-router'
import { defineComponent } from 'vue'

import { usersQueryOptions } from '~/utils/users'

const UsersComponent = defineComponent({
  setup() {
    const usersQuery = useQuery(usersQueryOptions())

    return () => {
      const users = [
        ...(usersQuery.data.value ?? []),
        { id: 'i-do-not-exist', name: 'Non-existent User', email: '' },
      ]

      return (
        <div class="p-2 flex gap-2">
          <ul class="list-disc pl-4">
            {users.map((user) => (
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
  },
})

export const Route = createFileRoute('/users')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(usersQueryOptions())
  },
  component: UsersComponent,
})
