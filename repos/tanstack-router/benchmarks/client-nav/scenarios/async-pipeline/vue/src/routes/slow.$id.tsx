import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { deferredHops, hopDelay, slowStateValue } from '../../../shared'

const SlowPage = Vue.defineComponent({
  setup() {
    const data = Route.useLoaderData()

    return () => <div data-testid="slow-state">{data.value.value}</div>
  },
})

export const Route = createFileRoute('/slow/$id')({
  staleTime: 0,
  gcTime: 0,
  loader: async ({ params }) => {
    await hopDelay(deferredHops)
    return { value: slowStateValue(params.id) }
  },
  component: SlowPage,
})
