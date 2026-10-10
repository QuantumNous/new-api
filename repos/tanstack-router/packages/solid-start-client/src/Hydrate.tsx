import { GenericHydrate } from './GenericHydrate'
import type {
  HydrationStrategy as CoreHydrationStrategy,
  HydrationPrefetchFunction,
  HydrationPrefetchStrategy,
  HydrationWhen,
} from '@tanstack/start-client-core/hydration'
import type * as Solid from 'solid-js'

export type {
  HydrationInteractionEvent,
  HydrationInteractionEvents,
  HydrationPrefetchContext,
  HydrationPrefetchFunction,
  HydrationPrefetchStrategy,
  HydrationPrefetchWaitReason,
  HydrationWhen,
} from '@tanstack/start-client-core/hydration'

export type SolidHydrationStrategy<
  TWhen extends HydrationWhen = HydrationWhen,
  TCanPrefetch extends boolean = boolean,
> = CoreHydrationStrategy<TWhen, TCanPrefetch> & {
  _h: (props: HydrateProps) => Solid.JSX.Element
}

export type HydrationStrategy<
  TWhen extends HydrationWhen = HydrationWhen,
  TCanPrefetch extends boolean = boolean,
> = SolidHydrationStrategy<TWhen, TCanPrefetch>

export type HydrateWhen =
  | SolidHydrationStrategy
  | (() => SolidHydrationStrategy)

type HydrateCommonOptions = {
  when: HydrateWhen
  fallback?: Solid.JSX.Element
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
  children: Solid.JSX.Element
}

export type InternalHydrateProps = HydrateProps & {
  h?: string
  p?: () => Promise<void>
}

/* @__NO_SIDE_EFFECTS__ */
export function Hydrate(props: HydrateProps) {
  if (
    typeof props.when === 'function' ||
    typeof props.prefetch === 'function'
  ) {
    return <GenericHydrate {...(props as InternalHydrateProps)} />
  }

  return props.when._h(props)
}
