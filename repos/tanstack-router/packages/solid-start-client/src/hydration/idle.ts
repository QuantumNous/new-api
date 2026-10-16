import {
  idle as coreIdle,
  withHydrationRenderer,
} from '@tanstack/start-client-core/hydration'
import { GenericHydrate } from '../GenericHydrate'
import type {
  HydrationPrefetchStrategy,
  IdleHydrationOptions,
} from '@tanstack/start-client-core/hydration'
import type { SolidHydrationStrategy } from '../Hydrate'

/* @__NO_SIDE_EFFECTS__ */
export function idle(
  options: IdleHydrationOptions = {},
): SolidHydrationStrategy<'idle', true> & HydrationPrefetchStrategy<'idle'> {
  return /* @__PURE__ */ withHydrationRenderer(
    coreIdle(options),
    GenericHydrate,
  )
}
