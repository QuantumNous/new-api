import { For, createRenderEffect } from 'solid-js'
import { createFileRoute } from '@tanstack/solid-router'
import { computeChecksum, itemsChecksum, makeItems } from '../../../shared'

export const Route = createFileRoute('/fresh/$id')({
  loader: ({ params }) => {
    const items = makeItems(`fresh-${params.id}`)
    return { items, checksum: itemsChecksum(items) }
  },
  staleTime: 0,
  gcTime: 0,
  component: FreshPage,
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

function FreshPage() {
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
      <h1>Fresh</h1>
      <div data-testid="fresh-state">{`f-${params().id}-${loaderData().checksum}`}</div>
      <ul>
        <For each={loaderData().items.slice(0, 5)}>
          {(item) => <li>{item.name}</li>}
        </For>
      </ul>
    </main>
  )
}
