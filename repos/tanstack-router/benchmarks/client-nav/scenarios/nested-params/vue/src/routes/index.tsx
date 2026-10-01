import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const HomePage = Vue.defineComponent({
  setup() {
    return () => <div data-testid="home-state">home</div>
  },
})

export const Route = createFileRoute('/')({
  component: HomePage,
})
