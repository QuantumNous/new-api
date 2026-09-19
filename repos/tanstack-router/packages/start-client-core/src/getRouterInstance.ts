import { getStartContext } from '@tanstack/start-storage-context'
import { createIsomorphicFn } from '@tanstack/start-fn-stubs'
import type { Awaitable, RegisteredRouter } from '@tanstack/router-core'

export const getRouterInstance: () => Awaitable<RegisteredRouter> =
  createIsomorphicFn()
    .client(() => window.__TSR_ROUTER__!)
    .server(() => getStartContext().getRouter())
