import { For, createRenderEffect } from 'solid-js'
import { createFileRoute } from '@tanstack/solid-router'
import { computeChecksum, itemsChecksum, makeItems } from '../../../shared'

export const Route = createFileRoute('/cached/$id')({
  loader: ({ params }) => {
    const items = makeItems(`cached-${params.id}`)
    return { items, checksum: itemsChecksum(items) }
  },
  staleTime: 1e9,
  gcTime: 1e9,
  component: CachedPage,
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

function FirstItemSubscriber() {
  const value = Route.useLoaderData({
    select: (data) => computeChecksum(data.items[0]?.value ?? 0),
  })

  return <PerfValue value={() => computeChecksum(value())} />
}

function CachedPage() {
  const params = Route.useParams()
  const loaderData = Route.useLoaderData()

  return (
    <main>
      {subscriberIndexes.map(() => (
        <SumSubscriber />
      ))}
      {subscriberIndexes.map(() => (
        <FirstItemSubscriber />
      ))}
      <h1>Cached</h1>
      <div data-testid="cached-state">{`c-${params().id}-${loaderData().checksum}`}</div>
      <ul>
        <For each={loaderData().items.slice(0, 5)}>
          {(item) => <li>{item.name}</li>}
        </For>
      </ul>
    </main>
  )
}
