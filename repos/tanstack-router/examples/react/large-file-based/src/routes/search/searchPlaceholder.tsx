import { createFileRoute } from '@tanstack/react-router'
import * as React from 'react'
import { Link } from '@tanstack/react-router'

import { z } from 'zod'
import { queryOptions } from '@tanstack/react-query'

const search = z.object({
  searchPlaceholder: z.literal('searchPlaceholder'),
  page: z.number(),
  offset: z.number(),
  search: z.string(),
})

const loaderResult = z.object({
  searchPlaceholder: z.number(),
})

const searchQueryOptions = queryOptions({
  queryKey: ['searchPlaceholder'],
  queryFn: () => {
    const result = loaderResult.parse({
      searchPlaceholder: 0,
    })

    return result
  },
})

export const Route = createFileRoute('/search/searchPlaceholder')({
  component: SearchComponent,
  validateSearch: search,
  loader: (opts) =>
    opts.context.queryClient.ensureQueryData(searchQueryOptions),
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
