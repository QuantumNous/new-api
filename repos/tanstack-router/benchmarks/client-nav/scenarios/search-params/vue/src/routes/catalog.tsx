import * as Vue from 'vue'
import { createFileRoute, retainSearchParams } from '@tanstack/vue-router'
import type { SearchSchemaInput } from '@tanstack/vue-router'
import {
  catalogMarkerText,
  computeChecksum,
  normalizeCatalogSearch,
} from '../../../shared'

const subscriberIndexes = Array.from({ length: 2 }, (_, index) => index)

const ViewSubscriber = Vue.defineComponent({
  setup() {
    const value = Route.useSearch({
      select: (search) =>
        computeChecksum(search.view.length * 5 + search.page * 11),
    })

    return () => {
      void computeChecksum(value.value)
      return null
    }
  },
})

const CatalogPage = Vue.defineComponent({
  setup() {
    const search = Route.useSearch()

    return () => (
      <main>
        {subscriberIndexes.map((index) => (
          <ViewSubscriber key={`view-${index}`} />
        ))}
        <h1>Catalog</h1>
        <div data-testid="catalog-state">{catalogMarkerText(search.value)}</div>
      </main>
    )
  },
})

export const Route = createFileRoute('/catalog')({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
    normalizeCatalogSearch(search),
  search: {
    middlewares: [retainSearchParams(['perPage', 'sort'])],
  },
  component: CatalogPage,
})
