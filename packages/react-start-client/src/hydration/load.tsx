'use client'

import * as React from 'react'

import {
  load as coreLoad,
  withHydrationRenderer,
} from '@tanstack/start-client-core/hydration'
import type { HydrationPrefetchStrategy } from '@tanstack/start-client-core/hydration'
import type { HydrateProps, ReactHydrationStrategy } from '../Hydrate'

function HydratedBoundary(props: {
  onHydrated?: () => void
  children: React.ReactNode
}) {
  const { onHydrated, children } = props
  const didHydrateRef = React.useRef(false)

  React.useEffect(() => {
    if (didHydrateRef.current) return
    didHydrateRef.current = true
    onHydrated?.()
  }, [onHydrated])

  return children as React.JSX.Element
}

export function LoadHydrate(props: HydrateProps): React.JSX.Element {
  return (
    <div>
      <React.Suspense fallback={props.fallback ?? null}>
        <HydratedBoundary onHydrated={props.onHydrated}>
          {props.children}
        </HydratedBoundary>
      </React.Suspense>
    </div>
  )
}

const loadStrategy = /* @__PURE__ */ withHydrationRenderer(
  coreLoad(),
  LoadHydrate,
) as ReactHydrationStrategy<'load', true> & HydrationPrefetchStrategy<'load'>

/* @__NO_SIDE_EFFECTS__ */
export function load(): ReactHydrationStrategy<'load', true> &
  HydrationPrefetchStrategy<'load'> {
  return loadStrategy
}
