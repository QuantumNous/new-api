import { createFileRoute } from '@tanstack/vue-router'
import { createLoaderData } from '../../../loader-data'

export const Route = createFileRoute('/page/$id')({
  loader: ({ params }: { params: { id: string } }) =>
    createLoaderData(params.id),
  component: PageComponent,
})

function PageComponent() {
  const data = Route.useLoaderData()

  return (
    <main
      data-bench-count={data.value.records.length}
      data-bench-id={data.value.id}
      data-bench-page="page"
    >
      {`${data.value.id}:${data.value.records.length}`}
    </main>
  )
}
