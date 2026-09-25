import * as Vue from 'vue'
import { createFileRoute } from '@tanstack/vue-router'
import { normalizeParam, smallHash } from '../../../shared'

const ParamsSubscriberOne = Vue.defineComponent({
  setup() {
    const value = Route.useParams({
      select: (params) => smallHash(params.h),
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
      select: (params) => smallHash(`${params.h}:2`),
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
      select: (context) => context.ctxH,
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
      select: (context) => (context.ctxH * 31 + 7) >>> 0,
    })
    return () => {
      void value.value
      return null
    }
  },
})

const LevelH = Vue.defineComponent({
  setup() {
    const params = Route.useParams()
    return () => (
      <>
        <ParamsSubscriberOne />
        <ParamsSubscriberTwo />
        <ContextSubscriberOne />
        <ContextSubscriberTwo />
        <div data-testid="leaf-state">
          {[
            params.value.a,
            params.value.b,
            params.value.c,
            params.value.d,
            params.value.e,
            params.value.f,
            params.value.g,
            params.value.h,
          ].join('.')}
        </div>
      </>
    )
  },
})

export const Route = createFileRoute('/l/$a/$b/$c/$d/$e/$f/$g/$h')({
  params: {
    parse: (params) => ({ ...params, h: normalizeParam(params.h) }),
    stringify: (params) => ({ ...params, h: String(params.h) }),
  },
  beforeLoad: ({ params }) => ({ ctxH: smallHash(params.h) }),
  component: LevelH,
})
