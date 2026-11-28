import {
  never as coreNever,
  withHydrationRenderer,
} from '@tanstack/start-client-core/hydration'
import { GenericHydrate } from '../GenericHydrate'
import type { SolidHydrationStrategy } from '../Hydrate'

/* @__NO_SIDE_EFFECTS__ */
export function never(): SolidHydrationStrategy<'never', false> {
  return /* @__PURE__ */ withHydrationRenderer(coreNever(), GenericHydrate)
}
