import { createFileRoute } from '@tanstack/react-router'
import { deferredHops, hopDelay, slowStateValue } from '../../../shared'

export const Route = createFileRoute('/slow/$id')({
  staleTime: 0,
  gcTime: 0,
  loader: async ({ params }) => {
    await hopDelay(deferredHops)
    return { value: slowStateValue(params.id) }
  },
  component: SlowPage,
})

function SlowPage() {
  const data = Route.useLoaderData()

  return <div data-testid="slow-state">{data.value}</div>
}
