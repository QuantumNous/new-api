import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { aboutMarker } from '../../../shared'

const AboutPage = Vue.defineComponent({
  setup() {
    return () => (
      <main>
        <p data-testid="page-state">{aboutMarker}</p>
      </main>
    )
  },
})

export const Route = createFileRoute('/about')({
  component: AboutPage,
})
