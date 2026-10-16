'use client'

import {
  idle as coreIdle,
  withHydrationRenderer,
} from '@tanstack/start-client-core/hydration'
import { GenericHydrate } from '../GenericHydrate'
import type {
  HydrationPrefetchStrategy,
  IdleHydrationOptions,
} from '@tanstack/start-client-core/hydration'
import type { ReactHydrationStrategy } from '../Hydrate'

/* @__NO_SIDE_EFFECTS__ */
export function idle(
  options: IdleHydrationOptions = {},
): ReactHydrationStrategy<'idle', true> & HydrationPrefetchStrategy<'idle'> {
  return /* @__PURE__ */ withHydrationRenderer(
    coreIdle(options),
    GenericHydrate,
  )
}
