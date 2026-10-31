import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { itemMarker } from '../../../shared'

const ItemPage = Vue.defineComponent({
  setup() {
    const params = Route.useParams()

    return () => (
      <main>
        <p data-testid="page-state">{itemMarker(params.value.id)}</p>
      </main>
    )
  },
})

export const Route = createFileRoute('/items/$id')({
  component: ItemPage,
})
