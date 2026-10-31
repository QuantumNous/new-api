import { createFileRoute } from '@tanstack/solid-router'
import * as Solid from 'solid-js'
import {
  Link,
  MatchRoute,
  Outlet,
  retainSearchParams,
  useNavigate,
  useRouterState,
} from '@tanstack/solid-router'
import { z } from 'zod'
import { createMemo } from 'solid-js'
import { Spinner } from '../components/Spinner'
import { fetchUsers } from '../utils/mockTodos'

type UsersViewSortBy = 'name' | 'id' | 'email'

export const Route = createFileRoute('/dashboard/users')({
  validateSearch: z.object({
    usersView: z
      .object({
        sortBy: z.enum(['name', 'id', 'email']).optional(),
        filterBy: z.string().optional(),
      })
      .optional(),
  }).parse,
  search: {
    // Retain the usersView search param while navigating
    // within or to this route (or it's children!)
    middlewares: [retainSearchParams(['usersView'])],
  },
  loaderDeps: ({ search }) => ({
    filterBy: search.usersView?.filterBy,
    sortBy: search.usersView?.sortBy,
  }),
  loader: async ({ deps }) => {
    const users = await fetchUsers(deps)
    return { users, crumb: 'Users' }
  },
  component: UsersComponent,
})

function UsersComponent() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const loaderData = Route.useLoaderData()

  const users = createMemo(() => loaderData()?.users)
  const sortBy = createMemo(() => search().usersView?.sortBy ?? 'name')
  const filterBy = createMemo(() => search().usersView?.filterBy)

  const [filterDraft, setFilterDraft] = Solid.createSignal(filterBy() ?? '')

  Solid.createEffect(() => {
    setFilterDraft(filterBy() ?? '')
  })

  const setSortBy = (sortBy: UsersViewSortBy) =>
    navigate({
      search: (old) => {
        return {
          ...old,
          usersView: {
            ...(old.usersView ?? {}),
            sortBy,
          },
        }
      },
      replace: true,
    })

  Solid.createEffect(() => {
    navigate({
      search: (old) => {
        return {
          ...old,
          usersView: {
            ...old.usersView,
            filterBy: filterDraft() || undefined,
          },
        }
      },
      replace: true,
    })
  })

  return (
    <div class="flex-1 flex">
      <div class="divide-y">
        <div class="py-2 px-3 flex gap-2 items-center bg-gray-100 dark:bg-gray-800">
          <div>Sort By:</div>
          <select
            value={sortBy()}
            onChange={(e) => setSortBy(e.target.value as UsersViewSortBy)}
            class="flex-1 border p-1 px-2 rounded-sm"
          >
            {['name', 'id', 'email'].map((d) => {
              return <option value={d} children={d} />
            })}
          </select>
        </div>
        <div class="py-2 px-3 flex gap-2 items-center bg-gray-100 dark:bg-gray-800">
          <div>Filter By:</div>
          <input
            value={filterDraft()}
            onChange={(e) => setFilterDraft(e.target.value)}
            placeholder="Search Names..."
            class="min-w-0 flex-1 border p-1 px-2 rounded-sm"
          />
        </div>
        <Solid.For each={users()}>
          {(user) => {
            return (
              <div>
                <Link
                  to="/dashboard/users/user"
                  search={{
                    userId: user.id,
                  }}
                  class="block py-2 px-3 text-blue-700"
                  activeProps={{ class: `font-bold` }}
                >
                  <pre class="text-sm">
                    {user.name}{' '}
                    <MatchRoute
                      to="/dashboard/users/user"
                      search={{
                        userId: user.id,
                      }}
                      pending
                    >
                      {(match) => <Spinner show={!!match} wait="delay-50" />}
                    </MatchRoute>
                  </pre>
                </Link>
              </div>
            )
          }}
        </Solid.For>
      </div>
      <div class="flex-initial border-l">
        <Outlet />
      </div>
    </div>
  )
}
