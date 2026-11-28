import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { pageLabel } from '../../../shared'

const PageComponent = Vue.defineComponent({
  setup() {
    const params = Route.useParams()

    return () => (
      <main>
        <h1 data-testid="page-state">{pageLabel(params.value.n)}</h1>
      </main>
    )
  },
})

export const Route = createFileRoute('/pages/$n')({
  component: PageComponent,
})
