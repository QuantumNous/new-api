import { For } from 'solid-js'
import { createFileRoute } from '@tanstack/solid-router'
import { sectionItems } from '../../../shared'

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

function SectionPage() {
  const params = Route.useParams()
  const data = Route.useLoaderData()

  return (
    <main>
      <p data-testid="page-state">{`${params().section}:${data().checksum}`}</p>
      <ul>
        <For each={data().items}>
          {(item) => <li>{`${item.name}=${item.value}`}</li>}
        </For>
      </ul>
    </main>
  )
}
