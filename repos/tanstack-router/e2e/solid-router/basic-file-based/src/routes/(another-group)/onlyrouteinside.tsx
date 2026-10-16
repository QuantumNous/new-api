import { createFileRoute } from '@tanstack/solid-router'
import { getRouteApi, useSearch } from '@tanstack/solid-router'
import { z } from 'zod'

const routeApi = getRouteApi('/(another-group)/onlyrouteinside')

export const Route = createFileRoute('/(another-group)/onlyrouteinside')({
  validateSearch: z.object({ hello: z.string().optional() }),
  component: () => {
    const searchViaHook = useSearch({
      from: '/(another-group)/onlyrouteinside',
    })
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
