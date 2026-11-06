import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    return () => <div data-testid="scale-state">sec-b:index</div>
  },
})

export const Route = createFileRoute('/sec-b/')({
  component: Page,
})
