import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    return () => <div data-testid="scale-state">sec-d:settings</div>
  },
})

export const Route = createFileRoute('/sec-d/settings')({
  component: Page,
})
