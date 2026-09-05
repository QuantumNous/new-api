import { Link, createFileRoute } from '@tanstack/solid-router'
import { z } from 'zod'
import { queryOptions } from '@tanstack/solid-query'

const params = z.object({
  oneParamsPlaceholder: z.literal('oneParamsPlaceholder'),
  twoParamsPlaceholder: z.literal('twoParamsPlaceholder'),
  threeParamsPlaceholder: z.literal('threeParamsPlaceholder'),
})

const loaderResult = z.object({
  params,
})

const paramsQueryOptions = queryOptions({
  queryKey: ['paramsPlaceholder'],
  queryFn: () => {
    return loaderResult.parse({})
  },
})

export const Route = createFileRoute('/params/$paramsPlaceholder')({
  component: ParamsComponent,
  loader: (opts) =>
    opts.context.queryClient.ensureQueryData(paramsQueryOptions),
})

function ParamsComponent() {
  return (
    <div class="p-2 space-y-2">
      <Link
        to="/params/$paramsPlaceholder"
        params={{
          paramsPlaceholder: 'params',
        }}
      />
    </div>
  )
}
