import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { makeQueryOptions } from '~/queryOptions'

const qOptions = makeQueryOptions('useSuspenseQuery')

export const Route = createFileRoute('/useSuspenseQuery')({
  component: RouteComponent,
})

function RouteComponent() {
  const query = useSuspenseQuery(qOptions)
  return (
    <div>
      <div>
        query data: <div data-testid="query-data">{query.data}</div>
      </div>
    </div>
  )
}
