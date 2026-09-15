import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { itemLabel } from '../../../shared'

const ItemPage = Vue.defineComponent({
  setup() {
    const params = Route.useParams()

    return () => (
      <article>
        <h2>{itemLabel(params.value.a, params.value.b)}</h2>
      </article>
    )
  },
})

export const Route = createFileRoute('/p/$a/$b')({
  component: ItemPage,
})
