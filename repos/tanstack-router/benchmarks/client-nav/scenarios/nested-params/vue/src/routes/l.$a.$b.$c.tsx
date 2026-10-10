import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { normalizeParam, smallHash } from '../../../shared'

const ParamsSubscriberOne = Vue.defineComponent({
  setup() {
    const value = Route.useParams({
      select: (params) => smallHash(params.c),
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
      select: (params) => smallHash(`${params.c}:2`),
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
      select: (context) => context.ctxC,
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
      select: (context) => (context.ctxC * 31 + 7) >>> 0,
    })
    return () => {
      void value.value
      return null
    }
  },
})

const LevelC = Vue.defineComponent({
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

export const Route = createFileRoute('/l/$a/$b/$c')({
  params: {
    parse: (params) => ({ ...params, c: normalizeParam(params.c) }),
    stringify: (params) => ({ ...params, c: String(params.c) }),
  },
  beforeLoad: ({ params }) => ({ ctxC: smallHash(params.c) }),
  component: LevelC,
})
