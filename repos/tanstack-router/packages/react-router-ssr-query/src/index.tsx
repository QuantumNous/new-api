import { Fragment } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { setupCoreRouterSsrQueryIntegration } from '@tanstack/router-ssr-query-core'
import type { RouterSsrQueryOptions } from '@tanstack/router-ssr-query-core'
import type { AnyRouter } from '@tanstack/react-router'

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
  const OGWrap = opts.router.options.Wrap || Fragment

  opts.router.options.Wrap = ({ children }) => {
    return (
      <QueryClientProvider client={opts.queryClient}>
        <OGWrap>{children}</OGWrap>
      </QueryClientProvider>
    )
  }
}
