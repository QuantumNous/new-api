import { createFileRoute } from '@tanstack/solid-router'

type ItemSearch = {
  q: string
}

export const Route = createFileRoute('/items/$id')({
  validateSearch: (search: Record<string, unknown>): ItemSearch => ({
    q: typeof search.q === 'string' ? search.q : '',
  }),
  loaderDeps: ({ search }) => ({ q: search.q }),
  loader: ({ params, deps }) => ({
    id: params.id,
    q: deps.q,
    checksum: params.id.length + deps.q.length,
  }),
  component: ItemComponent,
})

function ItemComponent() {
  const data = Route.useLoaderData()

  return (
    <main
      data-bench-id={data().id}
    >{`${data().id}:${data().q}:${data().checksum}`}</main>
  )
}
