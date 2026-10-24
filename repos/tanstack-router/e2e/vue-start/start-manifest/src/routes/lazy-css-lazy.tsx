import { createFileRoute } from '@tanstack/vue-router'
import { Suspense, defineAsyncComponent } from 'vue'

const LazySharedWidget = defineAsyncComponent(
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
        This route renders the same widget through a lazy component so the CSS
        only exists behind a dynamic import boundary.
      </p>

      <Suspense>
        {{
          default: () => <LazySharedWidget />,
          fallback: () => (
            <div data-testid="shared-widget-loading">Loading...</div>
          ),
        }}
      </Suspense>
    </section>
  )
}
