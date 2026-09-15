import { createFileRoute } from '@tanstack/react-router'
import { Hydrate } from '@tanstack/react-start'
import { media, never, visible } from '@tanstack/react-start/hydration'
import outerStyles from './css/outer.module.css'
import deferredStyles from './css/deferred-only.module.css'
import sharedStyles from './css/shared.module.css'

export const Route = createFileRoute('/css')({
  component: CssHydrationPage,
})

function CssHydrationPage() {
  return (
    <section className="dh-page">
      <header className="dh-hero dh-css">
        <h1 data-testid="css-heading" className={outerStyles.heading}>
          CSS Deferred Hydration
        </h1>
        <p>
          CSS from deferred, never, shared, and nested Hydrate boundaries should
          be available even before the client JavaScript hydrates those islands.
        </p>
      </header>
      <div className="dh-grid">
        <div data-testid="css-outer" className={outerStyles.outerBox}>
          Outer CSS
        </div>
        <div data-testid="css-shared-outer" className={sharedStyles.sharedBox}>
          Shared outer CSS
        </div>
      </div>
      <Hydrate when={visible({ rootMargin: '0px' })}>
        <div
          data-testid="css-deferred"
          className={`${deferredStyles.deferredBox} ${sharedStyles.sharedBox}`}
        >
          Deferred CSS
        </div>
      </Hydrate>
      <Hydrate when={never()}>
        <div
          data-testid="css-never"
          className={`${deferredStyles.neverBox} ${sharedStyles.sharedBox}`}
        >
          Never CSS
        </div>
      </Hydrate>
      <Hydrate when={media('(max-width: 1px)')}>
        <Hydrate when={never()}>
          <div data-testid="css-nested" className={deferredStyles.nestedBox}>
            Nested CSS
          </div>
        </Hydrate>
      </Hydrate>
    </section>
  )
}
