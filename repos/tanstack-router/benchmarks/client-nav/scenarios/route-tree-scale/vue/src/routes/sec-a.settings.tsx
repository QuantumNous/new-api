import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    return () => <div data-testid="scale-state">sec-a:settings</div>
  },
})

export const Route = createFileRoute('/sec-a/settings')({
  component: Page,
})
