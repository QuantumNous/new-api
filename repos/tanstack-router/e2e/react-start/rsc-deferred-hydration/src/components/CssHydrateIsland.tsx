'use client'

import * as React from 'react'
import { Hydrate } from '@tanstack/react-start'
import { media } from '@tanstack/react-start/hydration'
import { DeferredHydrateIsland } from './DeferredHydrateIsland'
import styles from './CssHydrateIsland.module.css'

function CssHydratePanel() {
  const [hydrated, setHydrated] = React.useState(false)

  React.useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <div data-testid="css-module-panel" className="strategy-card client-frame">
      <span className="badge">CSS module Hydrate island</span>
      <h2>CSS modules survive the RSC to client boundary</h2>
      <p
        className={`${styles.cssMarker} ${hydrated ? styles.cssMarkerHydrated : styles.cssMarkerPending}`}
        data-testid="css-module-marker"
      >
        {hydrated
          ? 'Hydrated module-styled client content'
          : 'Pending module-styled client content'}
      </p>
      <DeferredHydrateIsland
        id="css-nested"
        title="Nested client island"
        strategy="interaction"
      />
    </div>
  )
}

export function CssHydrateIsland() {
  return (
    <div data-testid="css-module-wrapper" className={styles.cssIsland}>
      <Hydrate when={media('(min-width: 1px)')}>
        <CssHydratePanel />
      </Hydrate>
    </div>
  )
}
