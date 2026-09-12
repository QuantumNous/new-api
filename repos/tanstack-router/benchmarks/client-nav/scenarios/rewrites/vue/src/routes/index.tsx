import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const HomePage = Vue.defineComponent({
  setup() {
    return () => (
      <main>
        <h1>Home</h1>
      </main>
    )
  },
})

export const Route = createFileRoute('/')({
  component: HomePage,
})
