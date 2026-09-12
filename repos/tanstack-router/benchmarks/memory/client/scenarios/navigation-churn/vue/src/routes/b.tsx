import { createFileRoute } from '@tanstack/vue-router'

const fixedTimestamp = 1_700_000_000_000

export const Route = createFileRoute('/b')({
  loader: () => ({ name: 'b', ts: fixedTimestamp }),
  component: BComponent,
})

function BComponent() {
  const data = Route.useLoaderData()

  return (
    <main data-bench-page="b">{`${data.value.name}:${data.value.ts}`}</main>
  )
}
