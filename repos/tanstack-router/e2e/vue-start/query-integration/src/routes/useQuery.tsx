import { useQuery } from '@tanstack/vue-query'
import { createFileRoute } from '@tanstack/vue-router'
import { makeQueryOptions } from '~/queryOptions'

const qOptions = makeQueryOptions('useQuery')

export const Route = createFileRoute('/useQuery')({
  loader: ({ context }) => context.queryClient.ensureQueryData(qOptions),
  component: RouteComponent,
  ssr: true,
})

function RouteComponent() {
  const query = useQuery(qOptions)
  return (
    <div>
      <div>
        query data:{' '}
        <div data-testid="query-data">{query.data.value ?? 'loading...'}</div>
      </div>
    </div>
  )
}
