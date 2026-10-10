'use client'

import * as React from 'react'

import { reactUse } from '@tanstack/react-router'
import { isServer } from '@tanstack/router-core/isServer'
import type {
  HydrationPrefetchStrategy,
  VisibleHydrationOptions,
} from '@tanstack/start-client-core/hydration'
import type {
  HydrateProps,
  InternalHydrateProps,
  ReactHydrationStrategy,
} from '../Hydrate'

type VisibleGate = {
  p: Promise<void>
  r: boolean
  s: () => void
}

/* @__NO_SIDE_EFFECTS__ */
function HydrationBoundary(props: {
  g: VisibleGate
  o?: () => void
  children?: React.ReactNode
}) {
  const { g, o } = props

  if (!g.r) {
    if (!reactUse) {
      throw g.p
    }

    reactUse(g.p)
  }

  React.useEffect(() => {
    o?.()
  }, [o])

  return props.children as React.JSX.Element
}

/* @__NO_SIDE_EFFECTS__ */
export function VisibleHydrate(
  this: ReactHydrationStrategy,
  props: HydrateProps,
): React.JSX.Element {
  const strategy = this as ReactHydrationStrategy<'visible', true>
  const prefetchStrategy = props.prefetch
  const preload = (props as InternalHydrateProps).p
  const markerRef = React.useRef<HTMLDivElement | null>(null)
  const [gate] = React.useState<VisibleGate>(() => {
    let resolvePromise!: () => void
    const nextGate: VisibleGate = {
      p: new Promise<void>((resolve) => {
        resolvePromise = resolve
      }),
      r: false,
      s: () => {
        nextGate.r = true
        resolvePromise()
      },
    }
    if (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      isServer ??
      typeof window === 'undefined'
    ) {
      nextGate.s()
    }

    return nextGate
  })

  React.useEffect(() => {
    if (!preload || typeof prefetchStrategy === 'function') {
      return
    }

    return prefetchStrategy?._s?.({
      element: markerRef.current,
      prefetch: preload,
    })
  }, [prefetchStrategy, preload])

  React.useEffect(() => {
    if (gate.r) return

    return strategy._s?.({
      element: markerRef.current,
      gate: gate as never,
    })
  }, [gate, strategy])

  return (
    <div ref={markerRef}>
      <React.Suspense fallback={props.fallback}>
        <HydrationBoundary g={gate} o={props.onHydrated}>
          {props.children}
        </HydrationBoundary>
      </React.Suspense>
    </div>
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function visible(
  options?: VisibleHydrationOptions,
): ReactHydrationStrategy<'visible', true> &
  HydrationPrefetchStrategy<'visible'> {
  const rootMargin = options?.rootMargin ?? '600px'
  const threshold = options?.threshold ?? 0

  return {
    _s: ({ element, gate, prefetch }) => {
      const callback = prefetch || (gate as never as VisibleGate).s

      if (!element) {
        callback()
        return
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries[0]!.isIntersecting) return
          observer.disconnect()
          callback()
        },
        { rootMargin, threshold },
      )
      observer.observe(element)
      return () => observer.disconnect()
    },
    _h: VisibleHydrate,
  }
}
