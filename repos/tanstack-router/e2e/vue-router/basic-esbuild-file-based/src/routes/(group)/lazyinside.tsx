import { createFileRoute, getRouteApi, useSearch } from '@tanstack/vue-router'
import { z } from 'zod'

export const Route = createFileRoute('/(group)/lazyinside')({
  validateSearch: z.object({ hello: z.string().optional() }),
  component: LazyInsideComponent,
})

const routeApi = getRouteApi('/(group)/lazyinside')

function LazyInsideComponent() {
  const searchViaHook = useSearch({ from: '/(group)/lazyinside' })
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
