'use client'

import {
  condition as coreCondition,
  interaction as coreInteraction,
  media as coreMedia,
  withHydrationRenderer,
} from '@tanstack/start-client-core/hydration'
import { GenericHydrate } from '../GenericHydrate'
import type {
  HydrationCondition,
  HydrationInteractionEvents,
  HydrationPrefetchStrategy,
} from '@tanstack/start-client-core/hydration'
import type { ReactHydrationStrategy } from '../Hydrate'

/* @__NO_SIDE_EFFECTS__ */
export function media(
  query: string,
): ReactHydrationStrategy<'media', true> & HydrationPrefetchStrategy<'media'> {
  return /* @__PURE__ */ withHydrationRenderer(coreMedia(query), GenericHydrate)
}

/* @__NO_SIDE_EFFECTS__ */
export function condition(
  condition: HydrationCondition,
): ReactHydrationStrategy<'condition', false> {
  return /* @__PURE__ */ withHydrationRenderer(
    coreCondition(condition),
    GenericHydrate,
  )
}

/* @__NO_SIDE_EFFECTS__ */
export function interaction(options?: {
  events?: HydrationInteractionEvents
}): ReactHydrationStrategy<'interaction', true> &
  HydrationPrefetchStrategy<'interaction'> {
  return /* @__PURE__ */ withHydrationRenderer(
    coreInteraction(options),
    GenericHydrate,
  )
}
