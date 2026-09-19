import { hydrateIdAttribute } from './hydration/constants'

export { condition } from './hydration/condition'
export type { HydrationCondition } from './hydration/condition'
export {
  hydrateIdAttribute,
  hydrateInteractionEventsAttribute,
  hydrateWhenAttribute,
} from './hydration/constants'
export const hydrateIdSelector = `[${hydrateIdAttribute}]`
export { idle } from './hydration/idle'
export type { IdleHydrationOptions } from './hydration/idle'
export { interaction } from './hydration/interaction'
export { load } from './hydration/load'
export { media } from './hydration/media'
export { never } from './hydration/never'
export {
  clearResolvedGateIdsInMarker,
  createResolvedGate,
  getFallbackHtml,
  getMarkerGate,
  getOrCreateGate,
  onGateResolve,
  releaseGate,
  resolveHydrationMarker,
  runHydrationStrategyCleanup,
  saveFallbackHtml,
  waitForHydrationPrefetchStrategy,
} from './hydration/runtime'
export { withHydrationRenderer } from './hydration/renderer'
export { visible } from './hydration/visible'
export { listenForDelegatedHydrationIntent } from './hydration/interaction'
export type { VisibleHydrationOptions } from './hydration/visible'
export type { HydrationGateRecord } from './hydration/runtime'
export type { HydrationStrategyWithRenderer } from './hydration/renderer'
export type {
  HydrationInteractionEvent,
  HydrationInteractionEvents,
  HydrationMarkerAttributes,
  HydrationPrefetchContext,
  HydrationPrefetchFunction,
  HydrationPrefetchWhen,
  HydrationPrefetchStrategy,
  HydrationPrefetchWaitReason,
  HydrationRuntimeContext,
  HydrationRuntimeGate,
  HydrationStrategy,
  HydrationStrategyTypes,
  HydrationWhen,
} from './hydration/types'
