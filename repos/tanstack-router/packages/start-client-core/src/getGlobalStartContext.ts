import { getStartContext } from '@tanstack/start-storage-context'
import { createIsomorphicFn } from '@tanstack/start-fn-stubs'
import type { AssignAllServerRequestContext } from './createMiddleware'
import type { Expand, Register } from '@tanstack/router-core'

export const getGlobalStartContext: () =>
  | Expand<AssignAllServerRequestContext<Register, []>>
  | undefined = createIsomorphicFn()
  .client(() => undefined)
  .server(() => {
    const context = getStartContext().contextAfterGlobalMiddlewares
    if (!context) {
      throw new Error(
        `Global context not set yet, you are calling getGlobalStartContext() before the global middlewares are applied.`,
      )
    }
    return context
  })
