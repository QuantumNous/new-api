import { createFileRoute } from '@tanstack/react-router'
import { getRouteApi, useSearch } from '@tanstack/react-router'
import { z } from 'zod'

const routeApi = getRouteApi('/(group)/_layout/insidelayout')

export const Route = createFileRoute('/(group)/_layout/insidelayout')({
  validateSearch: z.object({ hello: z.string().optional() }),
  component: () => {
    const searchViaHook = useSearch({ from: '/(group)/_layout/insidelayout' })
    const searchViaRouteHook = Route.useSearch()
    const searchViaRouteApi = routeApi.useSearch()
    return (
      <>
        <div data-testid="search-via-hook">{searchViaHook.hello}</div>
        <div data-testid="search-via-route-hook">
          {searchViaRouteHook.hello}
        </div>
        <div data-testid="search-via-route-api">{searchViaRouteApi.hello}</div>
      </>
    )
  },
})
