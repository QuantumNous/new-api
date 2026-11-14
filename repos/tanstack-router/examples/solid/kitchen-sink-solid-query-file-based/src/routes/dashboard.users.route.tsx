/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as Solid from 'solid-js'
import {
  Link,
  MatchRoute,
  Outlet,
  createFileRoute,
  retainSearchParams,
  useNavigate,
} from '@tanstack/solid-router'
import { useQuery } from '@tanstack/solid-query'
import { z } from 'zod'
import { Spinner } from '../components/Spinner'
import { usersQueryOptions } from '../utils/queryOptions'

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
  loader: (opts) =>
    opts.context.queryClient.ensureQueryData(usersQueryOptions(opts.deps)),
  component: UsersComponent,
})

function UsersComponent() {
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()
  const usersQuery = useQuery(() => usersQueryOptions(Route.useLoaderDeps()()))
  const users = usersQuery.data
  const sortBy = search().usersView?.sortBy ?? 'name'
  const filterBy = search().usersView?.filterBy

  const [filterDraft, setFilterDraft] = Solid.createSignal(filterBy ?? '')

  Solid.createEffect(() => {
    setFilterDraft(filterBy ?? '')
  }, [filterBy])

  const sortedUsers = Solid.createMemo(() => {
    if (!users) return []

    return !sortBy
      ? users
      : [...users].sort((a, b) => {
          return a[sortBy] > b[sortBy] ? 1 : -1
        })
  }, [users, sortBy])

  const filteredUsers = Solid.createMemo(() => {
    if (!filterBy) return sortedUsers()

    return sortedUsers().filter((user) =>
      user.name.toLowerCase().includes(filterBy.toLowerCase()),
    )
  }, [sortedUsers, filterBy])

  const setSortBy = (sortBy: UsersViewSortBy) =>
    navigate({
      search: (old) => {
        return {
          ...old,
          usersView: {
            ...(old?.usersView ?? {}),
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
            ...old?.usersView,
            filterBy: filterDraft() || undefined,
          },
        }
      },
      replace: true,
    })
  }, [filterDraft])

  return (
    <div class="flex-1 flex">
      <div class="divide-y">
        <div class="py-2 px-3 flex gap-2 items-center bg-gray-100 dark:bg-gray-800">
          <div>Sort By:</div>
          <select
            value={sortBy}
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
        {filteredUsers()?.map((user) => {
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
        })}
      </div>
      <div class="flex-initial border-l">
        <Outlet />
      </div>
    </div>
  )
}
