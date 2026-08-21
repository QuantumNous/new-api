import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { homeMarker } from '../../../shared'

const HomePage = Vue.defineComponent({
  setup() {
    return () => (
      <main>
        <p data-testid="page-state">{homeMarker}</p>
      </main>
    )
  },
})

export const Route = createFileRoute('/')({
  component: HomePage,
})
