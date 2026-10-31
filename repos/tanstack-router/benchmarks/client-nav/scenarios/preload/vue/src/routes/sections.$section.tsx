import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { sectionItems } from '../../../shared'

const SectionPage = Vue.defineComponent({
  setup() {
    const params = Route.useParams()
    const data = Route.useLoaderData()

    return () => (
      <main>
        <p data-testid="page-state">
          {`${params.value.section}:${data.value.checksum}`}
        </p>
        <ul>
          {data.value.items.map((item) => (
            <li key={item.name}>{`${item.name}=${item.value}`}</li>
          ))}
        </ul>
      </main>
    )
  },
})

export const Route = createFileRoute('/sections/$section')({
  loader: ({ params }) => {
    const items = sectionItems(params.section)
    const checksum = items.reduce(
      (sum, item) => (sum + item.value) % 1_000_000_007,
      0,
    )
    return { items, checksum }
  },
  staleTime: 0,
  gcTime: 0,
  component: SectionPage,
})
