import { createFileRoute } from '@tanstack/solid-router'
import { Suspense, lazy } from 'solid-js'

const LazySharedWidget = lazy(() => import('~/components/SharedWidgetLazy'))

export const Route = createFileRoute('/lazy-css-lazy')({
  component: LazyCssLazyRoute,
})

function LazyCssLazyRoute() {
  return (
    <section>
      <h1 data-testid="lazy-css-lazy-heading">Lazy CSS Repro - Lazy Route</h1>
      <p>
        This route renders the same widget through a lazy component so the CSS
        only exists behind a dynamic import boundary.
      </p>

      <Suspense
        fallback={<div data-testid="shared-widget-loading">Loading...</div>}
      >
        <LazySharedWidget />
      </Suspense>
    </section>
  )
}
