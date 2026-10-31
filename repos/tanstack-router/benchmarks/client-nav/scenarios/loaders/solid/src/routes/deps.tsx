import { For, createRenderEffect } from 'solid-js'
import { createFileRoute } from '@tanstack/solid-router'
import type { SearchSchemaInput } from '@tanstack/solid-router'
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

function PerfValue(props: { value: () => number }) {
  createRenderEffect(() => {
    void props.value()
  })

  return null
}

function SumSubscriber() {
  const value = Route.useLoaderData({
    select: (data) => computeChecksum(data.checksum),
  })

  return <PerfValue value={() => computeChecksum(value())} />
}

function DepsSubscriber() {
  const value = Route.useLoaderDeps({
    select: (deps) => computeChecksum(deps.page * 17),
  })

  return <PerfValue value={() => computeChecksum(value())} />
}

function DepsPage() {
  const search = Route.useSearch()
  const loaderData = Route.useLoaderData()

  return (
    <main>
      {subscriberIndexes.map(() => (
        <SumSubscriber />
      ))}
      {subscriberIndexes.map(() => (
        <DepsSubscriber />
      ))}
      <h1>Deps</h1>
      <div data-testid="deps-state">{`d-${search().page}-${loaderData().checksum}`}</div>
      <ul>
        <For each={loaderData().items.slice(0, 5)}>
          {(item) => <li>{item.name}</li>}
        </For>
      </ul>
    </main>
  )
}
