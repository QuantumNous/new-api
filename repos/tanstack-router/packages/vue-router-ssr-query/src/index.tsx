import * as Vue from 'vue'
import { setupCoreRouterSsrQueryIntegration } from '@tanstack/router-ssr-query-core'
import type { RouterSsrQueryOptions } from '@tanstack/router-ssr-query-core'
import type { AnyRouter } from '@tanstack/vue-router'

// Vue Query uses this string as the injection key
const VUE_QUERY_CLIENT = 'VUE_QUERY_CLIENT'

export type Options<TRouter extends AnyRouter> =
  RouterSsrQueryOptions<TRouter> & {
    wrapQueryClient?: boolean
  }

export function setupRouterSsrQueryIntegration<TRouter extends AnyRouter>(
  opts: Options<TRouter>,
) {
  setupCoreRouterSsrQueryIntegration(opts)

  if (opts.wrapQueryClient === false) {
    return
  }

  const OGWrap = opts.router.options.Wrap

  opts.router.options.Wrap = Vue.defineComponent({
    name: 'QueryClientWrapper',
    setup(_, { slots }) {
      Vue.provide(VUE_QUERY_CLIENT, opts.queryClient)
      return () => {
        const children = slots.default?.()
        if (OGWrap) {
          return Vue.h(OGWrap, null, () => children)
        }
        return children
      }
    },
  }) as any
}
