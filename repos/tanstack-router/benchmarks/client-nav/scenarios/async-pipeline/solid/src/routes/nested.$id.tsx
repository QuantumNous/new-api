import { createFileRoute } from '@tanstack/solid-router'
import { deferredHops, hopDelay, nestedStateValue } from '../../../shared'

export const Route = createFileRoute('/nested/$id')({
  staleTime: 0,
  gcTime: 0,
  loader: async ({ params }) => {
    await hopDelay(deferredHops)
    return { value: nestedStateValue(params.id) }
  },
  component: NestedPage,
})

function NestedPage() {
  const data = Route.useLoaderData()

  return <div data-testid="nested-state">{data().value}</div>
}
