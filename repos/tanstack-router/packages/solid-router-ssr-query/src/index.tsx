import { QueryClientProvider } from '@tanstack/solid-query'
import { setupCoreRouterSsrQueryIntegration } from '@tanstack/router-ssr-query-core'
import type { RouterSsrQueryOptions } from '@tanstack/router-ssr-query-core'
import type { AnyRouter } from '@tanstack/solid-router'
import type { JSX } from 'solid-js'

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

  const OGWrap =
    opts.router.options.Wrap ||
    ((props: { children: JSX.Element }) => props.children)

  opts.router.options.Wrap = (props) => {
    return (
      <QueryClientProvider client={opts.queryClient}>
        <OGWrap>{props.children}</OGWrap>
      </QueryClientProvider>
    )
  }
}
