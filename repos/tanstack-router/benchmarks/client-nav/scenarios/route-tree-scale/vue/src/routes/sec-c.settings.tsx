import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    return () => <div data-testid="scale-state">sec-c:settings</div>
  },
})

export const Route = createFileRoute('/sec-c/settings')({
  component: Page,
})
