import { createFileRoute, retainSearchParams } from '@tanstack/react-router'
import type { SearchSchemaInput } from '@tanstack/react-router'
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

function ViewSubscriber() {
  const value = Route.useSearch({
    select: (search) =>
      computeChecksum(search.view.length * 5 + search.page * 11),
  })

  void computeChecksum(value)
  return null
}

function CatalogPage() {
  const search = Route.useSearch()

  return (
    <main>
      {subscriberIndexes.map((index) => (
        <ViewSubscriber key={`view-${index}`} />
      ))}
      <h1>Catalog</h1>
      <div data-testid="catalog-state">{catalogMarkerText(search)}</div>
    </main>
  )
}
