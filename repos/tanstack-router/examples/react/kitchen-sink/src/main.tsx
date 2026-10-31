/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as React from 'react'
import ReactDOM from 'react-dom/client'
import {
  ErrorComponent,
  Link,
  MatchRoute,
  Outlet,
  RouterProvider,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  notFound,
  redirect,
  retainSearchParams,
  useNavigate,
  useRouter,
  useRouterState,
  useSearch,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { z } from 'zod'
import {
  fetchInvoiceById,
  fetchInvoices,
  fetchUserById,
  fetchUsers,
  patchInvoice,
  postInvoice,
} from './mockTodos'
import { useMutation } from './useMutation'
import type { NotFoundRouteProps } from '@tanstack/react-router'
import type { Invoice } from './mockTodos'
import './styles.css'

//

type UsersViewSortBy = 'name' | 'id' | 'email'

type MissingUserData = {
  userId: number
}

function isMissingUserData(data: unknown): data is MissingUserData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof (data as { userId?: unknown }).userId === 'number'
  )
}

function UsersNotFoundComponent({ data, routeId }: NotFoundRouteProps) {
  const userId = isMissingUserData(data) ? data.userId : undefined

  return (
    <div className="p-4 space-y-2">
      <h4 className="text-lg font-bold">User not found</h4>
      <p>
        {typeof userId === 'number'
          ? `We couldn't find a user with ID ${userId}.`
          : "We couldn't find the requested user."}
      </p>
      <p className="text-xs text-gray-500">
        Rendered by the "{routeId}" route.
      </p>
      <p className="text-sm text-gray-500">
        Pick another user from the list on the left to continue.
      </p>
    </div>
  )
}

const rootRoute = createRootRouteWithContext<{
  auth: Auth
}>()({
  component: RootComponent,
})

function RouterSpinner() {
  const isLoading = useRouterState({ select: (s) => s.status === 'pending' })
  return <Spinner show={isLoading} />
}

function RootComponent() {
  return (
    <>
      <div className={`min-h-screen flex flex-col`}>
        <div className={`flex items-center border-b gap-2`}>
          <h1 className={`text-3xl p-2`}>Kitchen Sink</h1>
          {/* Show a global spinner when the router is transitioning */}
          <div className={`text-3xl`}>
            <RouterSpinner />
          </div>
        </div>
        <div className={`flex-1 flex`}>
          <div className={`divide-y w-56`}>
            {(
              [
                ['/', 'Home'],
                ['/dashboard', 'Dashboard'],
                ['/expensive', 'Expensive'],
                ['/route-a', 'Pathless Layout A'],
                ['/route-b', 'Pathless Layout B'],
                ['/profile', 'Profile'],
                ...(auth.status === 'loggedOut' ? [['/login', 'Login']] : []),
              ] as const
            ).map(([to, label]) => {
              return (
                <div key={to}>
                  <Link
                    to={to}
                    activeOptions={
                      {
                        // If the route points to the root of it's parent,
                        // make sure it's only active if it's exact
                        // exact: to === '.',
                      }
                    }
                    preload="intent"
                    className={`block py-2 px-3 text-blue-700`}
                    // Make "active" links bold
                    activeProps={{ className: `font-bold` }}
                  >
                    {label}
                  </Link>
                </div>
              )
            })}
          </div>
          <div className={`flex-1 border-l`}>
            {/* Render our first route match */}
            <Outlet />
          </div>
        </div>
      </div>
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div className={`p-2`}>
      <div className={`text-lg`}>Welcome Home!</div>
      <hr className={`my-2`} />
      <Link
        to={invoiceRoute.to}
        params={{
          invoiceId: 3,
        }}
        className={`py-1 px-2 text-xs bg-blue-500 text-white rounded-full`}
      >
        1 New Invoice
      </Link>
      <hr className={`my-2`} />
      <div className={`max-w-xl`}>
        As you navigate around take note of the UX. It should feel
        suspense-like, where routes are only rendered once all of their data and
        elements are ready.
        <hr className={`my-2`} />
        To exaggerate async effects, play with the artificial request delay
        slider in the bottom-left corner.
        <hr className={`my-2`} />
        The last 2 sliders determine if link-hover preloading is enabled (and
        how long those preloads stick around) and also whether to cache rendered
        route data (and for how long). Both of these default to 0 (or off).
      </div>
    </div>
  )
}

const dashboardLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'dashboard',
  component: DashboardLayoutComponent,
})

function DashboardLayoutComponent() {
  return (
    <>
      <div className="flex items-center border-b">
        <h2 className="text-xl p-2">Dashboard</h2>
      </div>
      <div className="flex flex-wrap divide-x">
        {(
          [
            ['/dashboard', 'Summary', true],
            ['/dashboard/invoices', 'Invoices'],
            ['/dashboard/users', 'Users'],
          ] as const
        ).map(([to, label, exact]) => {
          return (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact }}
              activeProps={{ className: `font-bold` }}
              className="p-2"
            >
              {label}
            </Link>
          )
        })}
      </div>
      <hr />
      <Outlet />
    </>
  )
}

const dashboardIndexRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: '/',
  loader: () => fetchInvoices(),
  component: DashboardIndexComponent,
})

function DashboardIndexComponent() {
  const invoices = dashboardIndexRoute.useLoaderData()

  return (
    <div className="p-2">
      <div className="p-2">
        Welcome to the dashboard! You have{' '}
        <strong>{invoices.length} total invoices</strong>.
      </div>
    </div>
  )
}

const invoicesLayoutRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: 'invoices',
  loader: () => fetchInvoices(),
  component: InvoicesLayoutComponent,
})

function InvoicesLayoutComponent() {
  const invoices = invoicesLayoutRoute.useLoaderData()

  return (
    <div className="flex-1 flex">
      <div className="divide-y w-48">
        {invoices.map((invoice) => {
          return (
            <div key={invoice.id}>
              <Link
                to="/dashboard/invoices/$invoiceId"
                params={{
                  invoiceId: invoice.id,
                }}
                preload="intent"
                className="block py-2 px-3 text-blue-700"
                activeProps={{ className: `font-bold ` }}
              >
                <pre className="text-sm">
                  #{invoice.id} - {invoice.title.slice(0, 10)}{' '}
                  {/* {updateSubmission ? (
                      <Spinner />
                    ) : ( */}
                  <MatchRoute
                    to={invoiceRoute.to}
                    params={{
                      invoiceId: invoice.id,
                    }}
                    pending
                  >
                    {(match) => <Spinner show={!!match} wait="delay-50" />}
                  </MatchRoute>
                  {/* )} */}
                </pre>
              </Link>
            </div>
          )
        })}
      </div>
      <div className="flex-1 border-l">
        <Outlet />
      </div>
    </div>
  )
}

const invoicesIndexRoute = createRoute({
  getParentRoute: () => invoicesLayoutRoute,
  path: '/',
  component: InvoicesIndexComponent,
})

function InvoicesIndexComponent() {
  const createInvoiceMutation = useMutation({
    fn: postInvoice,
    onSuccess: () => router.invalidate(),
  })

  return (
    <>
      <div className="p-2">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            const formData = new FormData(event.target as HTMLFormElement)
            createInvoiceMutation.mutate({
              title: formData.get('title') as string,
              body: formData.get('body') as string,
            })
          }}
          className="space-y-2"
        >
          <div>Create a new Invoice:</div>
          <InvoiceFields invoice={{} as Invoice} />
          <div>
            <button
              className="bg-blue-500 rounded-sm p-2 uppercase text-white font-black disabled:opacity-50"
              disabled={createInvoiceMutation.status === 'pending'}
            >
              {createInvoiceMutation.status === 'pending' ? (
                <>
                  Creating <Spinner />
                </>
              ) : (
                'Create'
              )}
            </button>
          </div>
          {createInvoiceMutation.status === 'success' ? (
            <div className="inline-block px-2 py-1 rounded-sm bg-green-500 text-white animate-bounce [animation-iteration-count:2.5] [animation-duration:.3s]">
              Created!
            </div>
          ) : createInvoiceMutation.status === 'error' ? (
            <div className="inline-block px-2 py-1 rounded-sm bg-red-500 text-white animate-bounce [animation-iteration-count:2.5] [animation-duration:.3s]">
              Failed to create.
            </div>
          ) : null}
        </form>
      </div>
    </>
  )
}

const invoiceRoute = createRoute({
  getParentRoute: () => invoicesLayoutRoute,
  path: '$invoiceId',
  params: {
    parse: (params) => ({
      invoiceId: z.number().int().parse(Number(params.invoiceId)),
    }),
    stringify: ({ invoiceId }) => ({ invoiceId: `${invoiceId}` }),
  },
  validateSearch: (search) =>
    z
      .object({
        showNotes: z.boolean().optional(),
        notes: z.string().optional(),
      })
      .parse(search),
  loader: ({ params: { invoiceId } }) => fetchInvoiceById(invoiceId),
  component: InvoiceComponent,
  pendingComponent: () => <Spinner />,
})

function InvoiceComponent() {
  const search = invoiceRoute.useSearch()
  const navigate = useNavigate({ from: invoiceRoute.fullPath })
  const invoice = invoiceRoute.useLoaderData()
  const updateInvoiceMutation = useMutation({
    fn: patchInvoice,
    onSuccess: () => router.invalidate(),
  })
  const [notes, setNotes] = React.useState(search.notes ?? '')
  React.useEffect(() => {
    navigate({
      search: (old) => ({
        ...old,
        notes: notes ? notes : undefined,
      }),
      params: true,
      replace: true,
    })
  }, [notes])

  return (
    <form
      key={invoice.id}
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        const formData = new FormData(event.target as HTMLFormElement)
        updateInvoiceMutation.mutate({
          id: invoice.id,
          title: formData.get('title') as string,
          body: formData.get('body') as string,
        })
      }}
      className="p-2 space-y-2"
    >
      <InvoiceFields
        invoice={invoice}
        disabled={updateInvoiceMutation.status === 'pending'}
      />
      <div>
        <Link
          search={(old) => ({
            ...old,
            showNotes: old.showNotes ? undefined : true,
          })}
          className="text-blue-700"
          from={invoiceRoute.fullPath}
          params={true}
        >
          {search.showNotes ? 'Close Notes' : 'Show Notes'}{' '}
        </Link>
        {search.showNotes ? (
          <>
            <div>
              <div className="h-2" />
              <textarea
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value)
                }}
                rows={5}
                className="shadow-sm w-full p-2 rounded-sm"
                placeholder="Write some notes here..."
              />
              <div className="italic text-xs">
                Notes are stored in the URL. Try copying the URL into a new tab!
              </div>
            </div>
          </>
        ) : null}
      </div>
      <div>
        <button
          className="bg-blue-500 rounded-sm p-2 uppercase text-white font-black disabled:opacity-50"
          disabled={updateInvoiceMutation.status === 'pending'}
        >
          Save
        </button>
      </div>
      {updateInvoiceMutation.variables?.id === invoice.id ? (
        <div key={updateInvoiceMutation.submittedAt}>
          {updateInvoiceMutation.status === 'success' ? (
            <div className="inline-block px-2 py-1 rounded-sm bg-green-500 text-white animate-bounce [animation-iteration-count:2.5] [animation-duration:.3s]">
              Saved!
            </div>
          ) : updateInvoiceMutation.status === 'error' ? (
            <div className="inline-block px-2 py-1 rounded-sm bg-red-500 text-white animate-bounce [animation-iteration-count:2.5] [animation-duration:.3s]">
              Failed to save.
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  )
}

const usersLayoutRoute = createRoute({
  getParentRoute: () => dashboardLayoutRoute,
  path: 'users',
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
  loaderDeps: ({ search: { usersView } }) => ({
    filterBy: usersView?.filterBy,
    sortBy: usersView?.sortBy ?? 'name',
  }),
  loader: ({ deps }) => fetchUsers(deps),
  notFoundComponent: UsersNotFoundComponent,
  component: UsersLayoutComponent,
})

function UsersLayoutComponent() {
  const navigate = useNavigate({ from: usersLayoutRoute.fullPath })
  const { usersView } = usersLayoutRoute.useSearch()
  const users = usersLayoutRoute.useLoaderData()
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
            ...(old.usersView ?? {}),
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
            ...old.usersView,
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
        {filteredUsers.map((user) => {
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
                    to={userRoute.to}
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
        <div className="px-3 py-2 text-xs text-gray-500 bg-gray-100 dark:bg-gray-800/60">
          Need to see how not-found errors look?{' '}
          <Link
            to={userRoute.to}
            search={{
              userId: 404,
            }}
            className="text-blue-700"
          >
            Try loading user 404
          </Link>
        </div>
      </div>
      <div className="flex-initial border-l">
        <Outlet />
      </div>
    </div>
  )
}

const usersIndexRoute = createRoute({
  getParentRoute: () => usersLayoutRoute,
  path: '/',
  component: UsersIndexComponent,
})

function UsersIndexComponent() {
  return (
    <div className="p-2 space-y-2">
      <p>
        Normally, setting default search parameters would either need to be done
        manually in every link to a page, or as a side-effect (not a great
        experience).
      </p>
      <p>
        Instead, we can use <strong>search filters</strong> to provide defaults
        or even persist search params for links to routes (and child routes).
      </p>
      <p>
        A good example of this is the sorting and filtering of the users list.
        In a traditional router, both would be lost while navigating around
        individual users or even changing each sort/filter option unless each
        state was manually passed from the current route into each new link we
        created (that's a lot of tedious and error-prone work). With TanStack
        router and search filters, they are persisted with little effort.
      </p>
    </div>
  )
}

const userRoute = createRoute({
  getParentRoute: () => usersLayoutRoute,
  path: 'user',
  validateSearch: z.object({
    userId: z.number(),
  }),
  loaderDeps: ({ search: { userId } }) => ({
    userId,
  }),
  loader: async ({ deps: { userId } }) => {
    const user = await fetchUserById(userId)

    if (!user) {
      throw notFound({
        data: {
          userId,
        },
      })
    }

    return user
  },
  component: UserComponent,
})

function UserComponent() {
  const user = userRoute.useLoaderData()

  return (
    <>
      <h4 className="p-2 font-bold">{user?.name}</h4>
      <pre className="text-sm whitespace-pre-wrap">
        {JSON.stringify(user, null, 2)}
      </pre>
    </>
  )
}

const expensiveRoute = createRoute({
  getParentRoute: () => rootRoute,
  // Your elements can be asynchronous, which means you can code-split!
  path: 'expensive',
  component: lazyRouteComponent(() => import('./Expensive')),
})

const authPathlessLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'auth',
  // Before loading, authenticate the user via our auth context
  // This will also happen during prefetching (e.g. hovering over links, etc)
  beforeLoad: ({ context, location }) => {
    // If the user is logged out, redirect them to the login page
    if (context.auth.status === 'loggedOut') {
      console.log(location)
      throw redirect({
        to: loginRoute.to,
        search: {
          // Use the current location to power a redirect after login
          // (Do not use `router.state.resolvedLocation` as it can
          // potentially lag behind the actual current location)
          redirect: location.href,
        },
      })
    }

    // Otherwise, return the user in context
    return {
      username: auth.username,
    }
  },
})

const profileRoute = createRoute({
  getParentRoute: () => authPathlessLayoutRoute,
  path: 'profile',
  component: ProfileComponent,
})

function ProfileComponent() {
  const { username } = profileRoute.useRouteContext()

  return (
    <div className="p-2 space-y-2">
      <div>
        Username:<strong>{username}</strong>
      </div>
      <button
        className="text-sm bg-blue-500 text-white border inline-block py-1 px-2 rounded-sm"
        onClick={() => {
          auth.logout()
          router.invalidate()
        }}
      >
        Log out
      </button>
    </div>
  )
}

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'login',
  validateSearch: z.object({
    redirect: z.string().optional(),
  }),
}).update({
  component: LoginComponent,
})

function LoginComponent() {
  const router = useRouter()
  const { auth, status } = loginRoute.useRouteContext({
    select: ({ auth }) => ({ auth, status: auth.status }),
  })
  const search = useSearch({ from: loginRoute.fullPath })
  const [username, setUsername] = React.useState('')

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    auth.login(username)
    router.invalidate()
  }

  // Ah, the subtle nuances of client side auth. 🙄
  React.useLayoutEffect(() => {
    if (status === 'loggedIn' && search.redirect) {
      router.history.push(search.redirect)
    }
  }, [status, search.redirect])

  return status === 'loggedIn' ? (
    <div>
      Logged in as <strong>{auth.username}</strong>
      <div className="h-2" />
      <button
        onClick={() => {
          auth.logout()
          router.invalidate()
        }}
        className="text-sm bg-blue-500 text-white border inline-block py-1 px-2 rounded-sm"
      >
        Log out
      </button>
      <div className="h-2" />
    </div>
  ) : (
    <div className="p-2">
      <div>You must log in!</div>
      <div className="h-2" />
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="border p-1 px-2 rounded-sm"
        />
        <button className="text-sm bg-blue-500 text-white border inline-block py-1 px-2 rounded-sm">
          Login
        </button>
      </form>
    </div>
  )
}

const pathlessLayoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'pathless-layout',
  component: PathlessLayoutComponent,
})

function PathlessLayoutComponent() {
  return (
    <div>
      <div>Pathless Layout</div>
      <hr />
      <Outlet />
    </div>
  )
}

const pathlessLayoutARoute = createRoute({
  getParentRoute: () => pathlessLayoutRoute,
  path: 'route-a',
  component: PathlessLayoutAComponent,
})

function PathlessLayoutAComponent() {
  return (
    <div>
      <div>I'm A</div>
    </div>
  )
}

const pathlessLayoutBRoute = createRoute({
  getParentRoute: () => pathlessLayoutRoute,
  path: 'route-b',
  component: PathlessLayoutBComponent,
})

function PathlessLayoutBComponent() {
  return (
    <div>
      <div>I'm B</div>
    </div>
  )
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  dashboardLayoutRoute.addChildren([
    dashboardIndexRoute,
    invoicesLayoutRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
    usersLayoutRoute.addChildren([usersIndexRoute, userRoute]),
  ]),
  expensiveRoute,
  authPathlessLayoutRoute.addChildren([profileRoute]),
  loginRoute,
  pathlessLayoutRoute.addChildren([pathlessLayoutARoute, pathlessLayoutBRoute]),
])

const router = createRouter({
  routeTree,
  defaultPendingComponent: () => (
    <div className={`p-2 text-2xl`}>
      <Spinner />
    </div>
  ),
  defaultErrorComponent: ({ error }) => <ErrorComponent error={error} />,
  context: {
    auth: undefined!, // We'll inject this when we render
  },
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const auth: Auth = {
  status: 'loggedOut',
  username: undefined,
  login: (username: string) => {
    auth.username = username
    auth.status = 'loggedIn'
  },
  logout: () => {
    auth.status = 'loggedOut'
    auth.username = undefined
  },
}

function App() {
  // This stuff is just to tweak our sandbox setup in real-time
  const [loaderDelay, setLoaderDelay] = useSessionStorage('loaderDelay', 500)
  const [pendingMs, setPendingMs] = useSessionStorage('pendingMs', 1000)
  const [pendingMinMs, setPendingMinMs] = useSessionStorage('pendingMinMs', 500)

  return (
    <>
      <div className="text-xs fixed w-52 shadow-md shadow-black/20 rounded-sm bottom-2 left-2 bg-white dark:bg-gray-800 bg-opacity-75 border-b flex flex-col gap-1 flex-wrap items-left divide-y">
        <div className="p-2 space-y-2">
          <div className="flex gap-2">
            <button
              className="bg-blue-500 text-white rounded-sm p-1 px-2"
              onClick={() => {
                setLoaderDelay(150)
              }}
            >
              Fast
            </button>
            <button
              className="bg-blue-500 text-white rounded-sm p-1 px-2"
              onClick={() => {
                setLoaderDelay(500)
              }}
            >
              Fast 3G
            </button>
            <button
              className="bg-blue-500 text-white rounded-sm p-1 px-2"
              onClick={() => {
                setLoaderDelay(2000)
              }}
            >
              Slow 3G
            </button>
          </div>
          <div>
            <div>Loader Delay: {loaderDelay}ms</div>
            <input
              type="range"
              min="0"
              max="5000"
              step="100"
              value={loaderDelay}
              onChange={(e) => setLoaderDelay(e.target.valueAsNumber)}
              className="w-full"
            />
          </div>
        </div>
        <div className="p-2 space-y-2">
          <div className="flex gap-2">
            <button
              className="bg-blue-500 text-white rounded-sm p-1 px-2"
              onClick={() => {
                setPendingMs(1000)
                setPendingMinMs(500)
              }}
            >
              Reset to Default
            </button>
          </div>
          <div>
            <div>defaultPendingMs: {pendingMs}ms</div>
            <input
              type="range"
              min="0"
              max="5000"
              step="100"
              value={pendingMs}
              onChange={(e) => setPendingMs(e.target.valueAsNumber)}
              className="w-full"
            />
          </div>
          <div>
            <div>defaultPendingMinMs: {pendingMinMs}ms</div>
            <input
              type="range"
              min="0"
              max="5000"
              step="100"
              value={pendingMinMs}
              onChange={(e) => setPendingMinMs(e.target.valueAsNumber)}
              className="w-full"
            />
          </div>
        </div>
      </div>
      <RouterProvider
        router={router}
        defaultPreload="intent"
        defaultPendingMs={pendingMs}
        defaultPendingMinMs={pendingMinMs}
        context={{
          auth,
        }}
      />
    </>
  )
}

function InvoiceFields({
  invoice,
  disabled,
}: {
  invoice: Invoice
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <h2 className="font-bold text-lg">
        <input
          name="title"
          defaultValue={invoice.title}
          placeholder="Invoice Title"
          className="border border-opacity-50 rounded-sm p-2 w-full"
          disabled={disabled}
        />
      </h2>
      <div>
        <textarea
          name="body"
          defaultValue={invoice.body}
          rows={6}
          placeholder="Invoice Body..."
          className="border border-opacity-50 p-2 rounded-sm w-full"
          disabled={disabled}
        />
      </div>
    </div>
  )
}

type Auth = {
  login: (username: string) => void
  logout: () => void
  status: 'loggedOut' | 'loggedIn'
  username?: string
}

function Spinner({ show, wait }: { show?: boolean; wait?: `delay-${number}` }) {
  return (
    <div
      className={`inline-block animate-spin px-3 transition ${
        (show ?? true)
          ? `opacity-100 duration-500 ${wait ?? 'delay-300'}`
          : 'duration-500 opacity-0 delay-0'
      }`}
    >
      ⍥
    </div>
  )
}

function useSessionStorage<T>(key: string, initialValue: T) {
  const state = React.useState<T>(() => {
    const stored = sessionStorage.getItem(key)
    return stored ? JSON.parse(stored) : initialValue
  })

  React.useEffect(() => {
    sessionStorage.setItem(key, JSON.stringify(state[0]))
  }, [state[0]])

  return state
}

const rootElement = document.getElementById('app')!
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
