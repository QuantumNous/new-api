import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'

const LazySharedWidget = React.lazy(
  () => import('~/components/SharedWidgetLazy'),
)

export const Route = createFileRoute('/lazy-css-lazy')({
  component: LazyCssLazyRoute,
})

function LazyCssLazyRoute() {
  return (
    <section>
      <h1 data-testid="lazy-css-lazy-heading">Lazy CSS Repro - Lazy Route</h1>
      <p>
        This route renders the same widget through React.lazy so the CSS only
        exists behind a dynamic import boundary.
      </p>

      <React.Suspense
        fallback={<div data-testid="shared-widget-loading">Loading...</div>}
      >
        <LazySharedWidget />
      </React.Suspense>
    </section>
  )
}
