import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    return () => <div data-testid="scale-state">sec-a:index</div>
  },
})

export const Route = createFileRoute('/sec-a/')({
  component: Page,
})
