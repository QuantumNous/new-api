import * as React from 'react'
import { Hydrate } from '@tanstack/react-start'
import { interaction } from '@tanstack/react-start/hydration'

function ImportedHydrateChild() {
  const [count, setCount] = React.useState(0)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <button
      data-testid="imported-hydrate-child"
      data-hydrated={hydrated ? 'true' : 'false'}
      data-marker="imported-hydrate-child"
      onClick={() => setCount((prev) => prev + 1)}
    >
      Imported Hydrate Child:{' '}
      <span data-testid="imported-hydrate-count">{count}</span>
    </button>
  )
}

export function ImportedHydrateWidget() {
  return (
    <Hydrate
      when={interaction({ events: 'click' })}
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
