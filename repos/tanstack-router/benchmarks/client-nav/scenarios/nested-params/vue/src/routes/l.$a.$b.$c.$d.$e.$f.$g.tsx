import * as Vue from 'vue'
import { Outlet, createFileRoute } from '@tanstack/vue-router'
import { normalizeParam, smallHash } from '../../../shared'

const ParamsSubscriberOne = Vue.defineComponent({
  setup() {
    const value = Route.useParams({
      select: (params) => smallHash(params.g),
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
      select: (params) => smallHash(`${params.g}:2`),
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
      select: (context) => context.ctxG,
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
      select: (context) => (context.ctxG * 31 + 7) >>> 0,
    })
    return () => {
      void value.value
      return null
    }
  },
})

const LevelG = Vue.defineComponent({
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

export const Route = createFileRoute('/l/$a/$b/$c/$d/$e/$f/$g')({
  params: {
    parse: (params) => ({ ...params, g: normalizeParam(params.g) }),
    stringify: (params) => ({ ...params, g: String(params.g) }),
  },
  beforeLoad: ({ params }) => ({ ctxG: smallHash(params.g) }),
  component: LevelG,
})
