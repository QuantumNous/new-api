import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { computeChecksum, itemsChecksum, makeItems } from '../../../shared'

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

const FirstItemSubscriber = Vue.defineComponent({
  setup() {
    const value = Route.useLoaderData({
      select: (data) => computeChecksum(data.items[0]?.value ?? 0),
    })

    return () => {
      void computeChecksum(value.value)
      return null
    }
  },
})

const FreshPage = Vue.defineComponent({
  setup() {
    const params = Route.useParams()
    const loaderData = Route.useLoaderData()

    return () => (
      <main>
        {subscriberIndexes.map((index) => (
          <SumSubscriber key={`sum-${index}`} />
        ))}
        {subscriberIndexes.map((index) => (
          <FirstItemSubscriber key={`first-${index}`} />
        ))}
        <h1>Fresh</h1>
        <div data-testid="fresh-state">
          {`f-${params.value.id}-${loaderData.value.checksum}`}
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

export const Route = createFileRoute('/fresh/$id')({
  loader: ({ params }) => {
    const items = makeItems(`fresh-${params.id}`)
    return { items, checksum: itemsChecksum(items) }
  },
  staleTime: 0,
  gcTime: 0,
  component: FreshPage,
})
