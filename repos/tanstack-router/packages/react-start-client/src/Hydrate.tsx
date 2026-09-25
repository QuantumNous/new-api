'use client'

import * as React from 'react'

import { isServer } from '@tanstack/router-core/isServer'
import type {
  HydrationStrategy as CoreHydrationStrategy,
  HydrationPrefetchFunction,
  HydrationPrefetchStrategy,
  HydrationWhen,
} from '@tanstack/start-client-core/hydration'

export type {
  HydrationInteractionEvent,
  HydrationInteractionEvents,
  HydrationPrefetchContext,
  HydrationPrefetchFunction,
  HydrationPrefetchStrategy,
  HydrationPrefetchWaitReason,
  HydrationWhen,
} from '@tanstack/start-client-core/hydration'

export type ReactHydrationStrategy<
  TWhen extends HydrationWhen = HydrationWhen,
  TCanPrefetch extends boolean = boolean,
> = CoreHydrationStrategy<TWhen, TCanPrefetch> & {
  _h: (this: ReactHydrationStrategy, props: HydrateProps) => React.JSX.Element
}

export type HydrationStrategy<
  TWhen extends HydrationWhen = HydrationWhen,
  TCanPrefetch extends boolean = boolean,
> = ReactHydrationStrategy<TWhen, TCanPrefetch>

export type HydrateWhen =
  | ReactHydrationStrategy
  | (() => ReactHydrationStrategy)

type HydrateCommonOptions = {
  when: HydrateWhen
  fallback?: React.ReactNode
  onHydrated?: () => void
}

export type HydrateOptions =
  | (HydrateCommonOptions & {
      prefetch?: never
      split?: boolean
    })
  | (HydrateCommonOptions & {
      prefetch: HydrationPrefetchStrategy
      split?: true
    })
  | (HydrateCommonOptions & {
      prefetch: HydrationPrefetchFunction
      split?: boolean
    })

export type HydrateProps = HydrateOptions & {
  children: React.ReactNode
}

export type InternalHydrateProps = HydrateProps & {
  h?: string
  p?: () => Promise<void>
}

const dynamicType = 'dynamic'
const hydrateIdAttribute = 'data-ts-hydrate-id'
const hydrateWhenAttribute = 'data-ts-hydrate-when'

/* @__NO_SIDE_EFFECTS__ */
function ServerDynamicHydrate(props: HydrateProps): React.JSX.Element {
  const internalProps = props as InternalHydrateProps
  const reactId = React.useId()
  const id = internalProps.h ? `${internalProps.h}${reactId}` : reactId

  return (
    <div
      {...{
        [hydrateIdAttribute]: id,
        [hydrateWhenAttribute]: dynamicType,
      }}
    >
      <React.Suspense fallback={props.fallback ?? null}>
        {props.children}
      </React.Suspense>
    </div>
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function Hydrate(props: HydrateProps): React.JSX.Element {
  if (typeof props.when === 'function') {
    if (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      isServer ??
      typeof window === 'undefined'
    ) {
      return <ServerDynamicHydrate {...props} />
    }

    return props.when()._h(props)
  }

  return props.when._h(props)
}
