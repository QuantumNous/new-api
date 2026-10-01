import { createFileRoute } from '@tanstack/react-router'
/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as React from 'react'
import {
  Link,
  MatchRoute,
  Outlet,
  retainSearchParams,
  useNavigate,
} from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
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
    opts.context.queryClient.ensureQueryData(usersQueryOptions({})),
  component: UsersComponent,
})

function UsersComponent() {
  const navigate = useNavigate({ from: Route.fullPath })
  const { usersView } = Route.useSearch()
  const usersQuery = useSuspenseQuery(usersQueryOptions(Route.useLoaderDeps()))
  const users = usersQuery.data
  const sortBy = usersView?.sortBy ?? 'name'
  const filterBy = usersView?.filterBy

  const [filterDraft, setFilterDraft] = React.useState(filterBy ?? '')

  React.useEffect(() => {
    setFilterDraft(filterBy ?? '')
  }, [filterBy])

  const sortedUsers = React.useMemo(() => {
    if (!users) return []

    return !sortBy
      ? users
      : [...users].sort((a, b) => {
          return a[sortBy] > b[sortBy] ? 1 : -1
        })
  }, [users, sortBy])

  const filteredUsers = React.useMemo(() => {
    if (!filterBy) return sortedUsers

    return sortedUsers.filter((user) =>
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

  React.useEffect(() => {
    navigate({
      search: (old) => {
        return {
          ...old,
          usersView: {
            ...old?.usersView,
            filterBy: filterDraft || undefined,
          },
        }
      },
      replace: true,
    })
  }, [filterDraft])

  return (
    <div className="flex-1 flex">
      <div className="divide-y">
        <div className="py-2 px-3 flex gap-2 items-center bg-gray-100 dark:bg-gray-800">
          <div>Sort By:</div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as UsersViewSortBy)}
            className="flex-1 border p-1 px-2 rounded-sm"
          >
            {['name', 'id', 'email'].map((d) => {
              return <option key={d} value={d} children={d} />
            })}
          </select>
        </div>
        <div className="py-2 px-3 flex gap-2 items-center bg-gray-100 dark:bg-gray-800">
          <div>Filter By:</div>
          <input
            value={filterDraft}
            onChange={(e) => setFilterDraft(e.target.value)}
            placeholder="Search Names..."
            className="min-w-0 flex-1 border p-1 px-2 rounded-sm"
          />
        </div>
        {filteredUsers?.map((user) => {
          return (
            <div key={user.id}>
              <Link
                to="/dashboard/users/user"
                search={{
                  userId: user.id,
                }}
                className="block py-2 px-3 text-blue-700"
                activeProps={{ className: `font-bold` }}
              >
                <pre className="text-sm">
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
      <div className="flex-initial border-l">
        <Outlet />
      </div>
    </div>
  )
}
