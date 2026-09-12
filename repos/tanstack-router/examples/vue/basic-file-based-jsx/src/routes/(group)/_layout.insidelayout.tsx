import { createFileRoute, getRouteApi, useSearch } from '@tanstack/vue-router'
import { z } from 'zod'

export const Route = createFileRoute('/(group)/_layout/insidelayout')({
  validateSearch: z.object({ hello: z.string().optional() }),
  component: InsideLayoutComponent,
})

const routeApi = getRouteApi('/(group)/_layout/insidelayout')

function InsideLayoutComponent() {
  const searchViaHook = useSearch({ from: '/(group)/_layout/insidelayout' })
  const searchViaRouteHook = routeApi.useSearch()
  const searchViaRouteApi = routeApi.useSearch()

  return (
    <div>
      <div data-testid="search-via-hook">{searchViaHook.value.hello}</div>
      <div data-testid="search-via-route-hook">
        {searchViaRouteHook.value.hello}
      </div>
      <div data-testid="search-via-route-api">
        {searchViaRouteApi.value.hello}
      </div>
    </div>
  )
}
