import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    const params = Route.useParams()

    return () => (
      <div data-testid="scale-state">{`files:${params.value._splat}`}</div>
    )
  },
})

export const Route = createFileRoute('/files/$')({
  component: Page,
})
