import {
  load as coreLoad,
  withHydrationRenderer,
} from '@tanstack/start-client-core/hydration'
import { GenericHydrate } from '../GenericHydrate'
import type { HydrationPrefetchStrategy } from '@tanstack/start-client-core/hydration'
import type { SolidHydrationStrategy } from '../Hydrate'

/* @__NO_SIDE_EFFECTS__ */
export function load(): SolidHydrationStrategy<'load', true> &
  HydrationPrefetchStrategy<'load'> {
  return /* @__PURE__ */ withHydrationRenderer(coreLoad(), GenericHydrate)
}
