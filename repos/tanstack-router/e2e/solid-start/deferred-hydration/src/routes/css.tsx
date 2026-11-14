import { createFileRoute } from '@tanstack/solid-router'
import { Hydrate } from '@tanstack/solid-start'
import { media, never, visible } from '@tanstack/solid-start/hydration'
import outerStyles from './css/outer.module.css'
import deferredStyles from './css/deferred-only.module.css'
import sharedStyles from './css/shared.module.css'

export const Route = createFileRoute('/css')({
  component: CssHydrationPage,
})

function CssHydrationPage() {
  return (
    <section class="dh-page">
      <header class="dh-hero dh-css">
        <h1 data-testid="css-heading" class={outerStyles.heading}>
          CSS Deferred Hydration
        </h1>
        <p>
          CSS from deferred, never, shared, and nested Hydrate boundaries should
          be available even before the client JavaScript hydrates those islands.
        </p>
      </header>
      <div class="dh-grid">
        <div data-testid="css-outer" class={outerStyles.outerBox}>
          Outer CSS
        </div>
        <div data-testid="css-shared-outer" class={sharedStyles.sharedBox}>
          Shared outer CSS
        </div>
      </div>
      <Hydrate when={visible({ rootMargin: '0px' })}>
        <div
          data-testid="css-deferred"
          class={`${deferredStyles.deferredBox} ${sharedStyles.sharedBox}`}
        >
          Deferred CSS
        </div>
      </Hydrate>
      <Hydrate when={never()}>
        <div
          data-testid="css-never"
          class={`${deferredStyles.neverBox} ${sharedStyles.sharedBox}`}
        >
          Never CSS
        </div>
      </Hydrate>
      <Hydrate when={media('(max-width: 1px)')}>
        <Hydrate when={never()}>
          <div data-testid="css-nested" class={deferredStyles.nestedBox}>
            Nested CSS
          </div>
        </Hydrate>
      </Hydrate>
    </section>
  )
}
