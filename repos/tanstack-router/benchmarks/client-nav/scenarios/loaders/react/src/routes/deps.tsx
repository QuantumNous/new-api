import { createFileRoute } from '@tanstack/react-router'
import type { SearchSchemaInput } from '@tanstack/react-router'
import {
  computeChecksum,
  itemsChecksum,
  makeItems,
  normalizePage,
} from '../../../shared'

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

const subscriberIndexes = Array.from({ length: 2 }, (_, index) => index)

function SumSubscriber() {
  const value = Route.useLoaderData({
    select: (data) => computeChecksum(data.checksum),
  })

  void computeChecksum(value)
  return null
}

function DepsSubscriber() {
  const value = Route.useLoaderDeps({
    select: (deps) => computeChecksum(deps.page * 17),
  })

  void computeChecksum(value)
  return null
}

function DepsPage() {
  const search = Route.useSearch()
  const loaderData = Route.useLoaderData()

  return (
    <main>
      {subscriberIndexes.map((index) => (
        <SumSubscriber key={`sum-${index}`} />
      ))}
      {subscriberIndexes.map((index) => (
        <DepsSubscriber key={`deps-${index}`} />
      ))}
      <h1>Deps</h1>
      <div data-testid="deps-state">{`d-${search.page}-${loaderData.checksum}`}</div>
      <ul>
        {loaderData.items.slice(0, 5).map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </main>
  )
}
