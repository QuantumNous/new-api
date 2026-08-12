import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { normalizeParam, smallHash } from '../../../shared'

const ParamsSubscriberOne = Vue.defineComponent({
  setup() {
    const value = Route.useParams({
      select: (params) => smallHash(params.e),
    })
    return () => {
      void value.value
      return null
    }
  },
})

const ParamsSubscriberTwo = Vue.defineComponent({
  setup() {
    const value = Route.useParams({
      select: (params) => smallHash(`${params.e}:2`),
    })
    return () => {
      void value.value
      return null
    }
  },
})

const ContextSubscriberOne = Vue.defineComponent({
  setup() {
    const value = Route.useRouteContext({
      select: (context) => context.ctxE,
    })
    return () => {
      void value.value
      return null
    }
  },
})

const ContextSubscriberTwo = Vue.defineComponent({
  setup() {
    const value = Route.useRouteContext({
      select: (context) => (context.ctxE * 31 + 7) >>> 0,
    })
    return () => {
      void value.value
      return null
    }
  },
})

const LevelE = Vue.defineComponent({
  setup() {
    return () => (
      <>
        <ParamsSubscriberOne />
        <ParamsSubscriberTwo />
        <ContextSubscriberOne />
        <ContextSubscriberTwo />
        <Outlet />
      </>
    )
  },
})

export const Route = createFileRoute('/l/$a/$b/$c/$d/$e')({
  params: {
    parse: (params) => ({ ...params, e: normalizeParam(params.e) }),
    stringify: (params) => ({ ...params, e: String(params.e) }),
  },
  beforeLoad: ({ params }) => ({ ctxE: smallHash(params.e) }),
  component: LevelE,
})
