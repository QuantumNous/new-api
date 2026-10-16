import { createFileRoute, Link } from '@tanstack/react-router'
import * as v from 'valibot'
import { queryOptions } from '@tanstack/react-query'
import { createMiddleware, createServerFn } from '@tanstack/react-start'

const search = v.object({
  searchPlaceholder: v.literal('searchPlaceholder'),
  page: v.number(),
  offset: v.number(),
  search: v.string(),
})

const loaderResult = v.object({
  searchPlaceholder: v.number(),
})

const middleware = createMiddleware({ type: 'function' })
  .validator(search)
  .client(({ next }) => {
    const context = { client: { searchPlaceholder: 'searchPlaceholder' } }
    return next({
      context,
      sendContext: context,
    })
  })
  .server(({ next }) => {
    const context = { server: { searchPlaceholder: 'searchPlaceholder' } }
    return next({
      context,
      sendContext: context,
    })
  })

const fn = createServerFn()
  .middleware([middleware])
  .handler(() => {
    const result = v.parse(loaderResult, {
      searchPlaceholder: 0,
    })
    return result
  })

export const Route = createFileRoute('/search/searchPlaceholder')({
  server: {
    handlers: {
      GET: () => {
        return new Response('searchPlaceholder')
      },
    },
  },
  component: SearchComponent,
  validateSearch: search,
  loaderDeps: ({ search }) => ({ search }),
  context: (ctx) => ({
    searchQueryOptions: queryOptions({
      queryKey: ['searchPlaceholder'],
      queryFn: () => fn({ data: ctx.deps.search }),
    }),
  }),
  loader: async (opts) => {
    const search = await opts.context.queryClient.ensureQueryData(
      opts.context.searchQueryOptions,
    )

    return {
      search,
    }
  },
})

function SearchComponent() {
  return (
    <div className="p-2 space-y-2">
      <Link
        to="/search/searchPlaceholder"
        className="block py-1 text-blue-800 hover:text-blue-600"
        search={{
          searchPlaceholder: 'searchPlaceholder',
          page: 0,
          offset: 10,
          search: 'search',
          rootSearch: 0,
        }}
      >
        Search
      </Link>
    </div>
  )
}
