import { useQuery } from '@tanstack/solid-query'
import { Link, Outlet, createFileRoute } from '@tanstack/solid-router'
import { For } from 'solid-js'

import { usersQueryOptions } from '~/utils/users'

export const Route = createFileRoute('/users')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(usersQueryOptions())
  },
  component: UsersComponent,
})

function UsersComponent() {
  const usersQuery = useQuery(() => usersQueryOptions())

  return (
    <div class="p-2 flex gap-2">
      <ul class="list-disc pl-4">
        <For
          each={[
            ...(usersQuery.data ?? []),
            { id: 'i-do-not-exist', name: 'Non-existent User', email: '' },
          ]}
        >
          {(user) => (
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
          )}
        </For>
      </ul>
      <hr />
      <Outlet />
    </div>
  )
}
