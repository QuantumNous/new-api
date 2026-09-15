import { createRenderEffect } from 'solid-js'
import { createFileRoute, retainSearchParams } from '@tanstack/solid-router'
import type { SearchSchemaInput } from '@tanstack/solid-router'
import {
  catalogMarkerText,
  computeChecksum,
  normalizeCatalogSearch,
} from '../../../shared'

export const Route = createFileRoute('/catalog')({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
    normalizeCatalogSearch(search),
  search: {
    middlewares: [retainSearchParams(['perPage', 'sort'])],
  },
  component: CatalogPage,
})

const subscriberIndexes = Array.from({ length: 2 }, (_, index) => index)

function PerfValue(props: { value: () => number }) {
  createRenderEffect(() => {
    void props.value()
  })

  return null
}

function ViewSubscriber() {
  const value = Route.useSearch({
    select: (search) =>
      computeChecksum(search.view.length * 5 + search.page * 11),
  })

  return <PerfValue value={() => computeChecksum(value())} />
}

function CatalogPage() {
  const search = Route.useSearch()

  return (
    <main>
      {subscriberIndexes.map(() => (
        <ViewSubscriber />
      ))}
      <h1>Catalog</h1>
      <div data-testid="catalog-state">{catalogMarkerText(search())}</div>
    </main>
  )
}
