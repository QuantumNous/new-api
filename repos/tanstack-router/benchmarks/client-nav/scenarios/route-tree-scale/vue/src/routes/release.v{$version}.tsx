import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    const params = Route.useParams()

    return () => (
      <div data-testid="scale-state">{`release:${params.value.version}`}</div>
    )
  },
})

export const Route = createFileRoute('/release/v{$version}')({
  component: Page,
})
