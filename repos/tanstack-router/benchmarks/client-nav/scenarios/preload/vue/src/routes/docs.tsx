import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { docsMarker } from '../../../shared'

const DocsPage = Vue.defineComponent({
  setup() {
    return () => (
      <main>
        <p data-testid="page-state">{docsMarker}</p>
      </main>
    )
  },
})

export const Route = createFileRoute('/docs')({
  component: DocsPage,
})
