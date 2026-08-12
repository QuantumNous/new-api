import {
  visible as coreVisible,
  withHydrationRenderer,
} from '@tanstack/start-client-core/hydration'
import { GenericHydrate } from '../GenericHydrate'
import type {
  HydrationPrefetchStrategy,
  VisibleHydrationOptions,
} from '@tanstack/start-client-core/hydration'
import type { SolidHydrationStrategy } from '../Hydrate'

/* @__NO_SIDE_EFFECTS__ */
export function visible(
  options?: VisibleHydrationOptions,
): SolidHydrationStrategy<'visible', true> &
  HydrationPrefetchStrategy<'visible'> {
  return /* @__PURE__ */ withHydrationRenderer(
    coreVisible(options),
    GenericHydrate,
  )
}
