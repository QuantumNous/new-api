import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import {
  ctxSeedValue,
  ctxStateValue,
  deferredHops,
  hopDelay,
} from '../../../shared'

const CtxPage = Vue.defineComponent({
  setup() {
    const data = Route.useLoaderData()

    return () => <div data-testid="ctx-state">{data.value.value}</div>
  },
})

export const Route = createFileRoute('/ctx/$id')({
  staleTime: 0,
  gcTime: 0,
  beforeLoad: async ({ params }) => {
    await hopDelay(deferredHops)
    return { ctxSeed: ctxSeedValue(params.id) }
  },
  loader: ({ params, context }) => {
    if (context.ctxSeed !== ctxSeedValue(params.id)) {
      throw new Error('beforeLoad context missing in loader')
    }
    return { value: ctxStateValue(params.id) }
  },
  component: CtxPage,
})
