import { createFileRoute } from '@tanstack/react-router'
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

function SumSubscriber() {
  const value = Route.useLoaderData({
    select: (data) => computeChecksum(data.checksum),
  })

  void computeChecksum(value)
  return null
}

function FirstItemSubscriber() {
  const value = Route.useLoaderData({
    select: (data) => computeChecksum(data.items[0]?.value ?? 0),
  })

  void computeChecksum(value)
  return null
}

function FreshPage() {
  const params = Route.useParams()
  const loaderData = Route.useLoaderData()

  return (
    <main>
      {subscriberIndexes.map((index) => (
        <SumSubscriber key={`sum-${index}`} />
      ))}
      {subscriberIndexes.map((index) => (
        <FirstItemSubscriber key={`first-${index}`} />
      ))}
      <h1>Fresh</h1>
      <div data-testid="fresh-state">{`f-${params.id}-${loaderData.checksum}`}</div>
      <ul>
        {loaderData.items.slice(0, 5).map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </main>
  )
}
