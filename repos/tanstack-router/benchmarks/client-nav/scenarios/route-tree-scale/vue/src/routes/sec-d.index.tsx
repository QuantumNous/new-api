import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    return () => <div data-testid="scale-state">sec-d:index</div>
  },
})

export const Route = createFileRoute('/sec-d/')({
  component: Page,
})
