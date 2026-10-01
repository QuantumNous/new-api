import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { deferredHops, hopDelay, nestedStateValue } from '../../../shared'

const NestedPage = Vue.defineComponent({
  setup() {
    const data = Route.useLoaderData()

    return () => <div data-testid="nested-state">{data.value.value}</div>
  },
})

export const Route = createFileRoute('/nested/$id')({
  staleTime: 0,
  gcTime: 0,
  loader: async ({ params }) => {
    await hopDelay(deferredHops)
    return { value: nestedStateValue(params.id) }
  },
  component: NestedPage,
})
