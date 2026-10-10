import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    return () => <div data-testid="scale-state">sec-f:about</div>
  },
})

export const Route = createFileRoute('/sec-f/about')({
  component: Page,
})
