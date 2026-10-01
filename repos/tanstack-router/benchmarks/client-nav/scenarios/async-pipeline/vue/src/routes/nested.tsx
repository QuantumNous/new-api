import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { deferredHops, hopDelay, nestedLayoutValue } from '../../../shared'

const NestedLayout = Vue.defineComponent({
  setup() {
    const data = Route.useLoaderData()

    return () => (
      <section>
        <div data-testid="nested-layout">{data.value.value}</div>
        <Outlet />
      </section>
    )
  },
})

export const Route = createFileRoute('/nested')({
  staleTime: 0,
  gcTime: 0,
  loader: async () => {
    await hopDelay(deferredHops)
    return { value: nestedLayoutValue() }
  },
  component: NestedLayout,
})
