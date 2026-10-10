import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'

const TargetPage = Vue.defineComponent({
  setup() {
    return () => <div data-testid="target-state">target</div>
  },
})

export const Route = createFileRoute('/target')({
  component: TargetPage,
})
