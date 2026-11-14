import { createFileRoute } from '@tanstack/vue-router'

const itemIndexes = Array.from({ length: 5 }, (_, index) => index)

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
    title: `Item ${params.id}`,
    q: deps.q,
    items: itemIndexes.map((index) => ({
      id: `${params.id}-${index}`,
      label: `${deps.q}-${index}`,
    })),
  }),
  component: ItemComponent,
})

function ItemComponent() {
  const data = Route.useLoaderData()

  return (
    <main data-bench="request-churn-item">
      <h1>{data.value.title}</h1>
      <p>{data.value.q}</p>
      <ul>
        {data.value.items.map((item) => (
          <li key={item.id}>{item.label}</li>
        ))}
      </ul>
    </main>
  )
}
