import {
  Link,
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useParams,
  useSearch,
} from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'

function runPerfSelectorComputation(seed: number) {
  let value = Math.trunc(seed) | 0

  for (let index = 0; index < 40; index++) {
    value = (value * 1664525 + 1013904223 + index) >>> 0
  }

  return value
}

function normalizePage(value: unknown) {
  const page = Number(value)
  return Number.isFinite(page) && page > 0 ? Math.trunc(page) : 1
}

function normalizeFilter(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : 'all'
}

const noop = () => {}
const rootSelectors = Array.from({ length: 10 }, (_, index) => index)
const routeSelectors = Array.from({ length: 6 }, (_, index) => index)
const linkGroups = Array.from({ length: 4 }, (_, index) => index)

function RootParamsSubscriber() {
  const params = useParams({
    strict: false,
    select: (params) => runPerfSelectorComputation(Number(params.id ?? 0)),
  })

  void runPerfSelectorComputation(params)
  return null
}

function RootSearchSubscriber() {
  const search = useSearch({
    strict: false,
    select: (search) => runPerfSelectorComputation(Number(search.page ?? 0)),
  })

  void runPerfSelectorComputation(search)
  return null
}

function LinkPanel() {
  return (
    <>
      {linkGroups.map((groupIndex) => {
        const itemsId = groupIndex === 0 ? 1 : groupIndex + 2
        const ctxId = groupIndex + 1

        return (
          <div key={groupIndex}>
            <Link
              data-testid={groupIndex === 0 ? 'go-items-1' : undefined}
              to="/items/$id"
              params={{ id: itemsId }}
              replace
              activeOptions={{ exact: true }}
              activeProps={{ className: 'active-link' }}
              inactiveProps={{ className: 'inactive-link' }}
            >
              {`Items ${itemsId}`}
            </Link>
            <Link
              data-testid={groupIndex === 0 ? 'go-items-2' : undefined}
              to="/items/$id"
              params={{ id: 2 }}
              replace
              activeOptions={{ includeSearch: false }}
            >
              {`Items 2 alt ${groupIndex}`}
            </Link>
            <Link
              data-testid={groupIndex === 0 ? 'go-search' : undefined}
              to="/search"
              search={{ page: 1, filter: 'all', junk: `group-${groupIndex}` }}
              replace
              activeOptions={{ includeSearch: true }}
              activeProps={{ className: 'active-link' }}
              inactiveProps={{ className: 'inactive-link' }}
            >
              {`Search ${groupIndex}`}
            </Link>
            <Link
              data-testid={groupIndex === 0 ? 'go-ctx' : undefined}
              to="/ctx/$id"
              params={{ id: ctxId }}
              search={true}
              replace
              activeOptions={{ includeSearch: false }}
            >
              {`Context ${ctxId}`}
            </Link>
            <Link
              from={searchRoute.fullPath}
              to="/search"
              search={(prev: { page: number; filter: string }) => ({
                page: prev.page + groupIndex + 1,
                filter: prev.filter,
                junk: `updater-${groupIndex}`,
              })}
              activeOptions={{ includeSearch: true }}
            >
              {({ isActive }) =>
                isActive
                  ? `Search updater active ${groupIndex}`
                  : `Search updater inactive ${groupIndex}`
              }
            </Link>
          </div>
        )
      })}
    </>
  )
}

function Root() {
  return (
    <>
      {rootSelectors.map((selector) => (
        <RootParamsSubscriber key={`root-params-${selector}`} />
      ))}
      {rootSelectors.map((selector) => (
        <RootSearchSubscriber key={`root-search-${selector}`} />
      ))}
      <LinkPanel />
      <Outlet />
    </>
  )
}

const rootRoute = createRootRoute({
  component: Root,
})

const itemsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/items/$id',
  params: {
    parse: (params) => ({
      ...params,
      id: normalizePage(params.id),
    }),
    stringify: (params) => ({
      ...params,
      id: `${params.id}`,
    }),
  },
  onEnter: noop,
  onStay: noop,
  onLeave: noop,
  component: ItemsPage,
})

const itemDetailsRoute = createRoute({
  getParentRoute: () => itemsRoute,
  path: 'details',
  component: ItemDetailsPage,
})

const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  validateSearch: (search: Record<string, unknown>) => ({
    page: normalizePage(search.page),
    filter: normalizeFilter(search.filter),
  }),
  search: {
    middlewares: [
      ({ search, next }) => {
        const result = next(search)
        return {
          page: result.page,
          filter: result.filter,
        }
      },
    ],
  },
  loaderDeps: ({ search }) => ({
    page: search.page,
    filter: search.filter,
  }),
  loader: ({ deps }) => ({
    seed: deps.page * 31 + deps.filter.length,
    checksum: deps.page * 17 + deps.filter.length,
  }),
  staleTime: 60_000,
  gcTime: 60_000,
  component: SearchPage,
})

const contextRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/ctx/$id',
  beforeLoad: ({ params }) => ({
    sectionSeed: Number(params.id) * 13 + 1,
  }),
  component: ContextPage,
})

function ItemParamsSubscriber() {
  const params = itemsRoute.useParams({
    select: (params) => runPerfSelectorComputation(params.id),
  })

  void runPerfSelectorComputation(params)
  return null
}

function SearchStateSubscriber() {
  const search = searchRoute.useSearch({
    select: (search) =>
      runPerfSelectorComputation(search.page + search.filter.length),
  })

  void runPerfSelectorComputation(search)
  return null
}

function SearchLoaderDepsSubscriber() {
  const loaderDeps = searchRoute.useLoaderDeps({
    select: (loaderDeps) =>
      runPerfSelectorComputation(loaderDeps.page + loaderDeps.filter.length),
  })

  void runPerfSelectorComputation(loaderDeps)
  return null
}

function SearchLoaderDataSubscriber() {
  const loaderData = searchRoute.useLoaderData({
    select: (loaderData) =>
      runPerfSelectorComputation(loaderData.seed + loaderData.checksum),
  })

  void runPerfSelectorComputation(loaderData)
  return null
}

function ContextParamsSubscriber() {
  const params = contextRoute.useParams({
    select: (params) => runPerfSelectorComputation(Number(params.id)),
  })

  void runPerfSelectorComputation(params)
  return null
}

function ContextRouteSubscriber() {
  const context = contextRoute.useRouteContext({
    select: (context) => runPerfSelectorComputation(context.sectionSeed),
  })

  void runPerfSelectorComputation(context)
  return null
}

function ItemsPage() {
  return (
    <>
      {routeSelectors.map((selector) => (
        <ItemParamsSubscriber key={`item-params-${selector}`} />
      ))}
      <Link
        data-testid="items-details"
        from={itemsRoute.fullPath}
        to="./details"
        replace
      >
        Details
      </Link>
      <Link
        from={itemsRoute.fullPath}
        to="."
        search={true}
        activeOptions={{ includeSearch: true }}
      >
        Preserve search on item
      </Link>
      <Outlet />
    </>
  )
}

function ItemDetailsPage() {
  return (
    <>
      {routeSelectors.map((selector) => (
        <ItemParamsSubscriber key={`detail-params-${selector}`} />
      ))}
      <Link
        data-testid="items-parent"
        from={itemDetailsRoute.fullPath}
        to=".."
        replace
        activeOptions={{ exact: true }}
      >
        Back to item
      </Link>
    </>
  )
}

function SearchPage() {
  return (
    <>
      {routeSelectors.map((selector) => (
        <SearchStateSubscriber key={`search-state-${selector}`} />
      ))}
      {routeSelectors.map((selector) => (
        <SearchLoaderDepsSubscriber key={`search-loader-deps-${selector}`} />
      ))}
      {routeSelectors.map((selector) => (
        <SearchLoaderDataSubscriber key={`search-loader-data-${selector}`} />
      ))}
      <Link
        data-testid="search-next-page"
        from={searchRoute.fullPath}
        to="."
        replace
        search={(prev: { page: number; filter: string }) => ({
          page: prev.page + 1,
          filter: prev.filter,
          junk: 'local-updater',
        })}
        activeOptions={{ includeSearch: true }}
        activeProps={{ className: 'active-link' }}
        inactiveProps={{ className: 'inactive-link' }}
      >
        Next page
      </Link>
    </>
  )
}

function ContextPage() {
  return (
    <>
      {routeSelectors.map((selector) => (
        <ContextParamsSubscriber key={`context-params-${selector}`} />
      ))}
      {routeSelectors.map((selector) => (
        <ContextRouteSubscriber key={`context-route-${selector}`} />
      ))}
    </>
  )
}

export function mountTestApp(container: Element) {
  const router = createRouter({
    history: createMemoryHistory({
      initialEntries: ['/items/0'],
    }),
    scrollRestoration: true,
    routeTree: rootRoute.addChildren([
      itemsRoute.addChildren([itemDetailsRoute]),
      searchRoute,
      contextRoute,
    ]),
  })

  const reactRoot = createRoot(container)
  reactRoot.render(<RouterProvider router={router} />)

  return {
    router,
    unmount() {
      reactRoot.unmount()
    },
  }
}
