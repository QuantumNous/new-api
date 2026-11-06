import {
  createLazyFileRoute,
  getRouteApi,
  useSearch,
} from '@tanstack/react-router'

const routeApi = getRouteApi('/(group)/lazyinside')

export const Route = createLazyFileRoute('/(group)/lazyinside')({
  component: () => {
    const searchViaHook = useSearch({ from: '/(group)/lazyinside' })
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
