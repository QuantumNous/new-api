'use client'

import { Suspense, useState } from 'react'
import {
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from '@tanstack/react-query'
import { pageStyles } from './styles'
import { getNoLoaderCssServerComponent } from './noLoaderCssServerComponent'

const noLoaderCssQueryOptions = {
  queryKey: ['rsc-query-no-loader-css'],
  structuralSharing: false,
  queryFn: () =>
    getNoLoaderCssServerComponent({
      data: {
        title: 'CSS Modules via Render-Time Suspense Query',
        delayMs: 150,
      },
    }),
}

export function NoLoaderCssPageClient() {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <div style={pageStyles.container} data-testid="rsc-query-no-loader-page">
        <h1 style={pageStyles.title}>Suspense Query CSS Without Loader</h1>
        <p style={pageStyles.description}>
          This route skips a route loader entirely. React Query suspends during
          render, streams the fallback first, then resolves a styled RSC with
          its stylesheet links intact.
        </p>

        <Suspense
          fallback={
            <div
              data-testid="rsc-query-no-loader-fallback"
              style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: '#fef3c7',
                border: '1px solid #f59e0b',
                color: '#92400e',
              }}
            >
              Loading streamed RSC from render-time suspense query...
            </div>
          }
        >
          <NoLoaderCssResult />
        </Suspense>
      </div>
    </QueryClientProvider>
  )
}

function NoLoaderCssResult() {
  const { data: Server } = useSuspenseQuery(noLoaderCssQueryOptions)

  return <div data-testid="rsc-query-no-loader-resolved">{Server}</div>
}
