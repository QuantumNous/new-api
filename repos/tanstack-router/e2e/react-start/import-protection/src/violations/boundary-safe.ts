import {
  createIsomorphicFn,
  createServerFn,
  createServerOnlyFn,
} from '@tanstack/react-start'

import { getSecret } from './secret.server'

// NOTE: `getSecret` is only referenced inside compiler-recognized boundaries.
// The Start compiler should prune the `./secret.server` import from the client
// build output.

export const safeServerOnly = createServerOnlyFn(() => {
  return getSecret()
})

export const safeServerFn = createServerFn().handler(async () => {
  return getSecret()
})

export const safeIsomorphic = createIsomorphicFn()
  .server(() => {
    return getSecret()
  })
  .client(() => {
    return 'client'
  })
