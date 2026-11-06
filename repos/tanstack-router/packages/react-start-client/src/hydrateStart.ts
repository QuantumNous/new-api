import { hydrateStart as coreHydrateStart } from '@tanstack/start-client-core/client'
import type { AnyRouter } from '@tanstack/router-core'

/**
 * React-specific wrapper for hydrateStart that signals hydration completion
 */
export async function hydrateStart(): Promise<AnyRouter> {
  const router = await coreHydrateStart()
  // Signal that router hydration is complete so cleanup can happen if stream has ended
  window.$_TSR?.h()
  return router
}
