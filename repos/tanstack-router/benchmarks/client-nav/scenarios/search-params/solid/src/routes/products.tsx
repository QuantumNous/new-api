import { createRenderEffect } from 'solid-js'
import {
  createFileRoute,
  retainSearchParams,
  stripSearchParams,
} from '@tanstack/solid-router'
import type { SearchSchemaInput } from '@tanstack/solid-router'
import {
  computeChecksum,
  normalizeProductsSearch,
  productsLoaderChecksum,
  productsMarkerText,
} from '../../../shared'

export const Route = createFileRoute('/products')({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
    normalizeProductsSearch(search),
  search: {
    middlewares: [
      retainSearchParams(['perPage', 'sort']),
      stripSearchParams({ page: 1 }),
    ],
  },
  loaderDeps: ({ search }) => ({
    page: search.page,
    sort: search.sort,
    filters: search.filters,
  }),
  loader: ({ deps }) => ({
    checksum: productsLoaderChecksum(deps),
  }),
  staleTime: 1e9,
  gcTime: 1e9,
  component: ProductsPage,
})

const subscriberIndexes = Array.from({ length: 2 }, (_, index) => index)

function PerfValue(props: { value: () => number }) {
  createRenderEffect(() => {
    void props.value()
  })

  return null
}

function PageSubscriber() {
  const value = Route.useSearch({
    select: (search) => computeChecksum(search.page * 31 + search.perPage),
  })

  return <PerfValue value={() => computeChecksum(value())} />
}

function FiltersSubscriber() {
  const value = Route.useSearch({
    select: (search) =>
      computeChecksum(
        search.filters.categories.length * 7 +
          (search.filters.price.max - search.filters.price.min) +
          search.filters.tags.length * 3,
      ),
  })

  return <PerfValue value={() => computeChecksum(value())} />
}

function QuerySubscriber() {
  const value = Route.useSearch({
    select: (search) =>
      computeChecksum(search.q.length * 13 + search.sort.length),
  })

  return <PerfValue value={() => computeChecksum(value())} />
}

function ProductsPage() {
  const search = Route.useSearch()
  const loaderData = Route.useLoaderData()

  return (
    <main>
      {subscriberIndexes.map(() => (
        <PageSubscriber />
      ))}
      {subscriberIndexes.map(() => (
        <FiltersSubscriber />
      ))}
      {subscriberIndexes.map(() => (
        <QuerySubscriber />
      ))}
      <h1>Products</h1>
      <div data-testid="products-state">{productsMarkerText(search())}</div>
      <p>{`checksum ${loaderData().checksum}`}</p>
    </main>
  )
}
