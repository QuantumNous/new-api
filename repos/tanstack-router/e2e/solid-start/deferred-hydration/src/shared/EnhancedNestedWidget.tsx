import { createSignal, onMount } from 'solid-js'
import { Hydrate } from '@tanstack/solid-start'
import { interaction, media } from '@tanstack/solid-start/hydration'

function CrossFileNestedButton() {
  const [count, setCount] = createSignal(0)
  const [hydrated, setHydrated] = createSignal(false)

  onMount(() => {
    setHydrated(true)
  })

  return (
    <button
      data-testid="enhanced-cross-file-nested-button"
      data-hydrated={hydrated() ? 'true' : 'false'}
      onClick={() => setCount((prev) => prev + 1)}
    >
      cross-file nested child:{' '}
      <span data-testid="enhanced-cross-file-nested-count">{count()}</span>
    </button>
  )
}

export function EnhancedNestedWidget() {
  return (
    <Hydrate when={media('(max-width: 1px)')}>
      <Hydrate when={interaction({ events: 'click' })}>
        <CrossFileNestedButton />
      </Hydrate>
    </Hydrate>
  )
}
