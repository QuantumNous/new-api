import { createFileRoute } from '@tanstack/react-router'
import { homeItems, readyTestId } from '../../../shared'

export const Route = createFileRoute('/')({
  loader: () => homeItems(),
  component: HomePage,
})

function HomePage() {
  const items = Route.useLoaderData()

  return (
    <main>
      <h1 data-testid={readyTestId}>{`Home (${items.length} items)`}</h1>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{`${item.label}: ${item.score}`}</li>
        ))}
      </ul>
    </main>
  )
}
