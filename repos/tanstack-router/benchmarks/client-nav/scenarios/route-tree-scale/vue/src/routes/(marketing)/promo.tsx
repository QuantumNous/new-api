import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const Page = Vue.defineComponent({
  setup() {
    return () => <div data-testid="scale-state">promo</div>
  },
})

export const Route = createFileRoute('/(marketing)/promo')({
  component: Page,
})
