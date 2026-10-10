import * as React from 'react'
import { Hydrate } from '@tanstack/react-start'
import { interaction, media } from '@tanstack/react-start/hydration'

function CrossFileNestedButton() {
  const [count, setCount] = React.useState(0)
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <button
      data-testid="enhanced-cross-file-nested-button"
      data-hydrated={hydrated ? 'true' : 'false'}
      onClick={() => setCount((prev) => prev + 1)}
    >
      cross-file nested child:{' '}
      <span data-testid="enhanced-cross-file-nested-count">{count}</span>
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
