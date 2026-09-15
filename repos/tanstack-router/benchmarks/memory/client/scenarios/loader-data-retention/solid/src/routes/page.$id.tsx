import { createFileRoute } from '@tanstack/solid-router'
import { createLoaderData } from '../../../loader-data'

export const Route = createFileRoute('/page/$id')({
  loader: ({ params }) => createLoaderData(params.id),
  component: PageComponent,
})

function PageComponent() {
  const data = Route.useLoaderData()

  return (
    <main
      data-bench-count={data().records.length}
      data-bench-id={data().id}
      data-bench-page="page"
    >
      {`${data().id}:${data().records.length}`}
    </main>
  )
}
