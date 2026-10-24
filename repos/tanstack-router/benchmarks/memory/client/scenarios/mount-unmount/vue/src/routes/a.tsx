import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/a')({
  loader: () => ({ id: 'a' }),
  component: AComponent,
})

function AComponent() {
  const data = Route.useLoaderData()

  return <main data-bench-page={data.value.id}>{data.value.id}</main>
}
