import * as Vue from 'vue'
import {
  createFileRoute,
  retainSearchParams,
  stripSearchParams,
} from '@tanstack/vue-router'
import type { SearchSchemaInput } from '@tanstack/vue-router'
import {
  computeChecksum,
  normalizeProductsSearch,
  productsLoaderChecksum,
  productsMarkerText,
} from '../../../shared'

const subscriberIndexes = Array.from({ length: 2 }, (_, index) => index)

const PageSubscriber = Vue.defineComponent({
  setup() {
    const value = Route.useSearch({
      select: (search) => computeChecksum(search.page * 31 + search.perPage),
    })

    return () => {
      void computeChecksum(value.value)
      return null
    }
  },
})

const FiltersSubscriber = Vue.defineComponent({
  setup() {
    const value = Route.useSearch({
      select: (search) =>
        computeChecksum(
          search.filters.categories.length * 7 +
            (search.filters.price.max - search.filters.price.min) +
            search.filters.tags.length * 3,
        ),
    })

    return () => {
      void computeChecksum(value.value)
      return null
    }
  },
})

const QuerySubscriber = Vue.defineComponent({
  setup() {
    const value = Route.useSearch({
      select: (search) =>
        computeChecksum(search.q.length * 13 + search.sort.length),
    })

    return () => {
      void computeChecksum(value.value)
      return null
    }
  },
})

const ProductsPage = Vue.defineComponent({
  setup() {
    const search = Route.useSearch()
    const loaderData = Route.useLoaderData()

    return () => (
      <main>
        {subscriberIndexes.map((index) => (
          <PageSubscriber key={`page-${index}`} />
        ))}
        {subscriberIndexes.map((index) => (
          <FiltersSubscriber key={`filters-${index}`} />
        ))}
        {subscriberIndexes.map((index) => (
          <QuerySubscriber key={`query-${index}`} />
        ))}
        <h1>Products</h1>
        <div data-testid="products-state">
          {productsMarkerText(search.value)}
        </div>
        <p>{`checksum ${loaderData.value.checksum}`}</p>
      </main>
    )
  },
})

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
