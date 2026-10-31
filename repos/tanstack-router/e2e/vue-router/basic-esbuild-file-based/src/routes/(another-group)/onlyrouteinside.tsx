import { createFileRoute, getRouteApi, useSearch } from '@tanstack/vue-router'
import { z } from 'zod'

export const Route = createFileRoute('/(another-group)/onlyrouteinside')({
  validateSearch: z.object({ hello: z.string().optional() }),
  component: OnlyRouteInsideComponent,
})

const routeApi = getRouteApi('/(another-group)/onlyrouteinside')

function OnlyRouteInsideComponent() {
  const searchViaHook = useSearch({ from: '/(another-group)/onlyrouteinside' })
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
