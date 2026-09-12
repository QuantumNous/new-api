'use client'

import * as React from 'react'

import { reactUse, useHydrated } from '@tanstack/react-router'
import { isServer } from '@tanstack/router-core/isServer'
import {
  never as coreNever,
  withHydrationRenderer,
} from '@tanstack/start-client-core/hydration'
import {
  hydrateIdAttribute,
  hydrateWhenAttribute,
} from '@tanstack/start-client-core/hydration/constants'
import {
  getFallbackHtml,
  saveFallbackHtml,
} from '@tanstack/start-client-core/hydration/runtime'
import type {
  HydrateProps,
  InternalHydrateProps,
  ReactHydrationStrategy,
} from '../Hydrate'

const neverType = 'never'
const neverPromise = new Promise<void>(() => {})

function NeverGate(props: { children: React.ReactNode }) {
  if (
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    isServer ??
    typeof window === 'undefined'
  ) {
    return props.children as React.JSX.Element
  }

  if (!reactUse) {
    throw neverPromise
  }

  reactUse(neverPromise)

  return props.children as React.JSX.Element
}

export function NeverHydrate(props: HydrateProps): React.JSX.Element {
  const internalProps = props as InternalHydrateProps
  const hydrated = useHydrated()
  const reactId = React.useId()
  const id = internalProps.h ? `${internalProps.h}${reactId}` : reactId
  const shouldPreserveServerHTMLRef = React.useRef<boolean | undefined>(
    undefined,
  )
  shouldPreserveServerHTMLRef.current ??=
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    (isServer ?? typeof window === 'undefined') || !hydrated
  const markerRef = React.useCallback(
    (element: HTMLDivElement | null) => {
      if (!element) return
      if (!shouldPreserveServerHTMLRef.current) {
        element.replaceChildren()
      } else {
        saveFallbackHtml(id, element)
      }
    },
    [id],
  )
  const markerProps = {
    ref: markerRef,
    [hydrateIdAttribute]: id,
    [hydrateWhenAttribute]: neverType,
  }
  const fallback = (() => {
    const html = getFallbackHtml(id)
    return html ? (
      <div
        style={{ display: 'contents' }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    ) : (
      (props.fallback ?? null)
    )
  })()

  return (
    <div {...markerProps}>
      <React.Suspense fallback={fallback}>
        <NeverGate>{props.children}</NeverGate>
      </React.Suspense>
    </div>
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function never(): ReactHydrationStrategy<'never', false> {
  return /* @__PURE__ */ withHydrationRenderer(coreNever(), NeverHydrate)
}
