'use client'

export { condition, interaction, media } from './hydration/generic'
export { idle } from './hydration/idle'
export { load } from './hydration/load'
export { never } from './hydration/never'
export { visible } from './hydration/visible'
export type {
  HydrationCondition,
  HydrationInteractionEvent,
  HydrationInteractionEvents,
  IdleHydrationOptions,
  HydrationPrefetchContext,
  HydrationPrefetchFunction,
  HydrationPrefetchWhen,
  HydrationPrefetchStrategy,
  HydrationPrefetchWaitReason,
  HydrationStrategyTypes,
  HydrationWhen,
  VisibleHydrationOptions,
} from '@tanstack/start-client-core/hydration'
export type { HydrationStrategy, ReactHydrationStrategy } from './Hydrate'
