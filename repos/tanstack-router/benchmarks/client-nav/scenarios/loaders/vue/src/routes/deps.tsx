import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import type { SearchSchemaInput } from '@tanstack/vue-router'
import {
  computeChecksum,
  itemsChecksum,
  makeItems,
  normalizePage,
} from '../../../shared'

const subscriberIndexes = Array.from({ length: 2 }, (_, index) => index)

const SumSubscriber = Vue.defineComponent({
  setup() {
    const value = Route.useLoaderData({
      select: (data) => computeChecksum(data.checksum),
    })

    return () => {
      void computeChecksum(value.value)
      return null
    }
  },
})

const DepsSubscriber = Vue.defineComponent({
  setup() {
    const value = Route.useLoaderDeps({
      select: (deps) => computeChecksum(deps.page * 17),
    })

    return () => {
      void computeChecksum(value.value)
      return null
    }
  },
})

const DepsPage = Vue.defineComponent({
  setup() {
    const search = Route.useSearch()
    const loaderData = Route.useLoaderData()

    return () => (
      <main>
        {subscriberIndexes.map((index) => (
          <SumSubscriber key={`sum-${index}`} />
        ))}
        {subscriberIndexes.map((index) => (
          <DepsSubscriber key={`deps-${index}`} />
        ))}
        <h1>Deps</h1>
        <div data-testid="deps-state">
          {`d-${search.value.page}-${loaderData.value.checksum}`}
        </div>
        <ul>
          {loaderData.value.items.slice(0, 5).map((item) => (
            <li key={item.id}>{item.name}</li>
          ))}
        </ul>
      </main>
    )
  },
})

export const Route = createFileRoute('/deps')({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) => ({
    page: normalizePage(search.page),
  }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: ({ deps }) => {
    const items = makeItems(`deps-${deps.page}`)
    return { items, checksum: itemsChecksum(items) }
  },
  staleTime: 1e9,
  gcTime: 1e9,
  component: DepsPage,
})
