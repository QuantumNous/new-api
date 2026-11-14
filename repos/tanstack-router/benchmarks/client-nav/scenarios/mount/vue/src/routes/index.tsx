import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { homeItems, readyTestId } from '../../../shared'

const HomePage = Vue.defineComponent({
  setup() {
    const items = Route.useLoaderData()

    return () => (
      <main>
        <h1
          data-testid={readyTestId}
        >{`Home (${items.value.length} items)`}</h1>
        <ul>
          {items.value.map((item) => (
            <li key={item.id}>{`${item.label}: ${item.score}`}</li>
          ))}
        </ul>
      </main>
    )
  },
})

export const Route = createFileRoute('/')({
  loader: () => homeItems(),
  component: HomePage,
})
