import { createSignal } from 'solid-js'

import { Hydrate } from '@tanstack/solid-start'
import { media } from '@tanstack/solid-start/hydration'

function ImportedHydrateChild() {
  const [count, setCount] = createSignal(0)

  return (
    <button
      data-testid="imported-hydrate-child"
      data-marker="imported-hydrate-child"
      onClick={() => setCount((prev) => prev + 1)}
    >
      Imported Hydrate Child:{' '}
      <span data-testid="imported-hydrate-count">{count()}</span>
    </button>
  )
}

export function ImportedHydrateWidget() {
  return (
    <Hydrate
      when={media('(max-width: 1px)')}
      fallback={
        <div data-testid="imported-hydrate-fallback">
          imported hydrate fallback
        </div>
      }
    >
      <ImportedHydrateChild />
    </Hydrate>
  )
}
