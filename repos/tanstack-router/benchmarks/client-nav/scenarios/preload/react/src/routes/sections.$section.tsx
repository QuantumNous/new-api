import { createFileRoute } from '@tanstack/react-router'
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
      <p data-testid="page-state">{`${params.section}:${data.checksum}`}</p>
      <ul>
        {data.items.map((item) => (
          <li key={item.name}>{`${item.name}=${item.value}`}</li>
        ))}
      </ul>
    </main>
  )
}
