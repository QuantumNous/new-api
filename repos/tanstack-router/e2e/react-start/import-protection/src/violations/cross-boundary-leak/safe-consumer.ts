import { createServerFn } from '@tanstack/react-start'
import { getSharedData } from './shared-util'

// Safe: uses the shared utility ONLY inside a compiler boundary.
// The compiler strips this from the client; fetchModule adds shared-util.ts
// to the serverFnLookupModules set.
export const safeFn = createServerFn().handler(async () => {
  return getSharedData()
})
