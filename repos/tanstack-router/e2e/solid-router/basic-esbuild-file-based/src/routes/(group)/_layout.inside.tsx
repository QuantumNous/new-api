import { createFileRoute, getRouteApi, useSearch } from '@tanstack/solid-router'
import { z } from 'zod'

const routeApi = getRouteApi('/(group)/_layout/inside')

export const Route = createFileRoute('/(group)/_layout/inside')({
  validateSearch: z.object({ hello: z.string().optional() }),
  component: () => {
    const searchViaHook = useSearch({ from: '/(group)/_layout/inside' })
    const searchViaRouteHook = Route.useSearch()
    const searchViaRouteApi = routeApi.useSearch()
    return (
      <>
        <div data-testid="search-via-hook">{searchViaHook().hello}</div>
        <div data-testid="search-via-route-hook">
          {searchViaRouteHook().hello}
        </div>
        <div data-testid="search-via-route-api">
          {searchViaRouteApi().hello}
        </div>
      </>
    )
  },
})
