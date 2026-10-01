import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const HomePage = Vue.defineComponent({
  setup() {
    return () => (
      <main>
        <h1>Loaders Bench</h1>
        <div data-testid="home-state">home</div>
      </main>
    )
  },
})

export const Route = createFileRoute('/')({
  component: HomePage,
})
