import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { normalizeParam, smallHash } from '../../../shared'

const ParamsSubscriberOne = Vue.defineComponent({
  setup() {
    const value = Route.useParams({
      select: (params) => smallHash(params.d),
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
      select: (params) => smallHash(`${params.d}:2`),
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
      select: (context) => context.ctxD,
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
      select: (context) => (context.ctxD * 31 + 7) >>> 0,
    })
    return () => {
      void value.value
      return null
    }
  },
})

const LevelD = Vue.defineComponent({
  setup() {
    const params = Route.useParams()
    return () => (
      <>
        <ParamsSubscriberOne />
        <ParamsSubscriberTwo />
        <ContextSubscriberOne />
        <ContextSubscriberTwo />
        <div data-testid="mid-state">
          {[
            params.value.a,
            params.value.b,
            params.value.c,
            params.value.d,
          ].join('.')}
        </div>
        <Outlet />
      </>
    )
  },
})

export const Route = createFileRoute('/l/$a/$b/$c/$d')({
  params: {
    parse: (params) => ({ ...params, d: normalizeParam(params.d) }),
    stringify: (params) => ({ ...params, d: String(params.d) }),
  },
  beforeLoad: ({ params }) => ({ ctxD: smallHash(params.d) }),
  component: LevelD,
})
