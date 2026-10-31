import { createFileRoute } from '@tanstack/react-router'
import { Link, getRouteApi, useSearch } from '@tanstack/react-router'
import React from 'react'
import { z } from 'zod'

const enabledSchema = {
  enabled: z.preprocess((val) => {
    if (typeof val === 'string') {
      if (val.toLowerCase() === 'true') return true
      if (val.toLowerCase() === 'false') return false
    }
    return val
  }, z.boolean()),
}

export const Route = createFileRoute('/structural-sharing/$enabled')({
  component: RouteComponent,
  params: {
    parse: (p) => z.object(enabledSchema).parse(p),
  },
  validateSearch: z.object({ foo: z.string(), bar: z.string() }),
})

function useRenderCount() {
  const count = React.useRef(0)
  count.current++
  return count.current
}

const api = getRouteApi('/structural-sharing/$enabled')
function RouteComponent() {
  console.log('rendering')
  const renderCount = useRenderCount()
  const { enabled } = Route.useParams()

  const searchViaRouteHook = Route.useSearch({
    select: ({ foo, bar }) => {
      return { values: [foo, bar] }
    },
    structuralSharing: enabled,
  })

  const searchViaHook = useSearch({
    from: Route.id,
    select: ({ foo, bar }) => {
      return { values: [foo, bar] }
    },
    structuralSharing: enabled,
  })

  const searchViaRouteApiHook = api.useSearch({
    select: ({ foo, bar }) => {
      return { values: [foo, bar] }
    },
    structuralSharing: enabled,
  })

  return (
    <>
      <div data-testid="enabled">{JSON.stringify(enabled)}</div>
      <div data-testid="render-count">{renderCount}</div>
      <div data-testid="search-via-hook">{JSON.stringify(searchViaHook)}</div>
      <div data-testid="search-via-route-hook">
        {JSON.stringify(searchViaRouteHook)}
      </div>
      <div data-testid="search-via-route-api-hook">
        {JSON.stringify(searchViaRouteApiHook)}
      </div>

      <br />
      <Link
        search={{ foo: 'f2', bar: 'b2' }}
        from="/structural-sharing/$enabled"
        data-testid="link"
      >
        go to f2/b2
      </Link>
    </>
  )
}
