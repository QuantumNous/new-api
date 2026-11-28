import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    const params = Route.useParams()

    return () => (
      <div data-testid="scale-state">{`sec-f:${params.value.id}`}</div>
    )
  },
})

export const Route = createFileRoute('/sec-f/$id')({
  component: Page,
})
