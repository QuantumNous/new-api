import { createFileRoute } from '@tanstack/react-router'

const fixedTimestamp = 1_700_000_000_000

export const Route = createFileRoute('/b')({
  loader: () => ({ name: 'b', ts: fixedTimestamp }),
  component: BComponent,
})

function BComponent() {
  const data = Route.useLoaderData()

  return <main data-bench-page="b">{`${data.name}:${data.ts}`}</main>
}
