import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { normalizeParam, smallHash } from '../../../shared'

const ParamsSubscriberOne = Vue.defineComponent({
  setup() {
    const value = Route.useParams({
      select: (params) => smallHash(params.f),
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
      select: (params) => smallHash(`${params.f}:2`),
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
      select: (context) => context.ctxF,
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
      select: (context) => (context.ctxF * 31 + 7) >>> 0,
    })
    return () => {
      void value.value
      return null
    }
  },
})

const LevelF = Vue.defineComponent({
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

export const Route = createFileRoute('/l/$a/$b/$c/$d/$e/$f')({
  params: {
    parse: (params) => ({ ...params, f: normalizeParam(params.f) }),
    stringify: (params) => ({ ...params, f: String(params.f) }),
  },
  beforeLoad: ({ params }) => ({ ctxF: smallHash(params.f) }),
  component: LevelF,
})
