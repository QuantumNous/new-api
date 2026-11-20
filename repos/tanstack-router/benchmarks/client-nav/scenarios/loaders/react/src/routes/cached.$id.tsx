import { createFileRoute } from '@tanstack/react-router'
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

function CachedPage() {
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
      <h1>Cached</h1>
      <div data-testid="cached-state">{`c-${params.id}-${loaderData.checksum}`}</div>
      <ul>
        {loaderData.items.slice(0, 5).map((item) => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </main>
  )
}
