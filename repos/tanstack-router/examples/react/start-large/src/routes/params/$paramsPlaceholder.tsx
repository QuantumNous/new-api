import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import * as v from 'valibot'
import { queryOptions } from '@tanstack/react-query'
import { createMiddleware, createServerFn } from '@tanstack/react-start'

const params = v.object({
  oneParamsPlaceholder: v.literal('oneParamsPlaceholder'),
  twoParamsPlaceholder: v.literal('twoParamsPlaceholder'),
  threeParamsPlaceholder: v.literal('threeParamsPlaceholder'),
})

const loaderResult = v.object({
  params,
})

const middleware = createMiddleware({ type: 'function' })
  .validator(params)
  .client(({ next }) => {
    const context = { client: { paramsPlaceholder: 'paramsPlaceholder' } }
    return next({
      context,
      sendContext: context,
    })
  })
  .server(({ next }) => {
    const context = { server: { paramsPlaceholder: 'paramsPlaceholder' } }
    return next({
      context,
      sendContext: context,
    })
  })

const fn = createServerFn()
  .middleware([middleware])
  .handler(() => {
    return v.parse(loaderResult, {})
  })

const paramsQueryOptions = queryOptions({
  queryKey: ['paramsPlaceholder'],
  queryFn: () => {
    return v.parse(loaderResult, {})
  },
})

export const Route = createFileRoute('/params/$paramsPlaceholder')({
  component: ParamsComponent,
  context: () => ({
    paramsQueryOptions: queryOptions({
      queryKey: ['paramsPlaceholder'],
      queryFn: async () =>
        await fn({
          data: {
            oneParamsPlaceholder: 'oneParamsPlaceholder',
            twoParamsPlaceholder: 'twoParamsPlaceholder',
            threeParamsPlaceholder: 'threeParamsPlaceholder',
          },
        }),
    }),
  }),
  loader: (opts) =>
    opts.context.queryClient.ensureQueryData(paramsQueryOptions),
})

function ParamsComponent() {
  return (
    <div className="p-2 space-y-2">
      <Link
        to="/params/$paramsPlaceholder"
        params={{
          paramsPlaceholder: 'params',
        }}
      />
    </div>
  )
}
