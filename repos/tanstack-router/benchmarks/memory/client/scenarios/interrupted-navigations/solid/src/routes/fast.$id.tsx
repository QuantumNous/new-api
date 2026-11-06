import { createFileRoute } from '@tanstack/solid-router'
import { fixedTimestamp } from '../../../slow-loaders'

export const Route = createFileRoute('/fast/$id')({
  loader: ({ params }) => ({
    id: params.id,
    kind: 'fast' as const,
    ts: fixedTimestamp,
  }),
  component: FastComponent,
})

function FastComponent() {
  const data = Route.useLoaderData()

  return (
    <main data-bench-id={data().id} data-bench-page="fast">
      {`${data().kind}:${data().id}:${data().ts}`}
    </main>
  )
}
