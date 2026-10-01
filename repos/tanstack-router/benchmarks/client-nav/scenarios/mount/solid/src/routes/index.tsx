import { For } from 'solid-js'
import { createFileRoute } from '@tanstack/solid-router'
import { homeItems, readyTestId } from '../../../shared'

export const Route = createFileRoute('/')({
  loader: () => homeItems(),
  component: HomePage,
})

function HomePage() {
  const items = Route.useLoaderData()

  return (
    <main>
      <h1 data-testid={readyTestId}>{`Home (${items().length} items)`}</h1>
      <ul>
        <For each={items()}>
          {(item) => <li>{`${item.label}: ${item.score}`}</li>}
        </For>
      </ul>
    </main>
  )
}
