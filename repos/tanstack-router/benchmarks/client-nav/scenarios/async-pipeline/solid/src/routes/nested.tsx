import { Outlet, createFileRoute } from '@tanstack/solid-router'
import { deferredHops, hopDelay, nestedLayoutValue } from '../../../shared'

export const Route = createFileRoute('/nested')({
  staleTime: 0,
  gcTime: 0,
  loader: async () => {
    await hopDelay(deferredHops)
    return { value: nestedLayoutValue() }
  },
  component: NestedLayout,
})

function NestedLayout() {
  const data = Route.useLoaderData()

  return (
    <section>
      <div data-testid="nested-layout">{data().value}</div>
      <Outlet />
    </section>
  )
}
