import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { makeQueryOptions } from '~/queryOptions'

const qOptions = makeQueryOptions('useQuery')

export const Route = createFileRoute('/useQuery')({
  component: RouteComponent,
  ssr: true,
})

function RouteComponent() {
  const query = useQuery({ ...qOptions, gcTime: 0 })
  return (
    <div>
      <div>
        query data:{' '}
        <div data-testid="query-data">{query.data ?? 'loading...'}</div>
      </div>
    </div>
  )
}
