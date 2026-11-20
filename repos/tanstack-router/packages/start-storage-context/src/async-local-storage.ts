import { AsyncLocalStorage } from 'node:async_hooks'
import type {
  Awaitable,
  ManifestRouteAssets,
  RegisteredRouter,
} from '@tanstack/router-core'

export type StartHandlerType = 'router' | 'serverFn'

export interface StartStorageContext {
  getRouter: () => Awaitable<RegisteredRouter>
  request: Request
  // TODO type this properly
  startOptions: /* AnyStartInstanceOptions*/ any

  contextAfterGlobalMiddlewares: any
  // Track middlewares that have already executed in the request phase
  // to prevent duplicate execution
  executedRequestMiddlewares: Set<any>
  // Type of handler processing this request
  handlerType: StartHandlerType

  /**
   * Additional assets to inject for this request.
   * Plugins can add manifest route assets here during request processing.
   * Merged into manifest at dehydration time without mutating cached manifest.
   */
  requestAssets?: ManifestRouteAssets
}

// Use a global symbol to ensure the same AsyncLocalStorage instance is shared
// across different bundles that may each bundle this module.
const GLOBAL_STORAGE_KEY = Symbol.for('tanstack-start:start-storage-context')

const globalObj = globalThis as typeof globalThis & {
  [GLOBAL_STORAGE_KEY]?: AsyncLocalStorage<StartStorageContext>
}

if (!globalObj[GLOBAL_STORAGE_KEY]) {
  globalObj[GLOBAL_STORAGE_KEY] = new AsyncLocalStorage<StartStorageContext>()
}

const startStorage = globalObj[GLOBAL_STORAGE_KEY]

export async function runWithStartContext<T>(
  context: StartStorageContext,
  fn: () => T | Promise<T>,
): Promise<T> {
  return startStorage.run(context, fn)
}

export function getStartContext<TThrow extends boolean = true>(opts?: {
  throwIfNotFound?: TThrow
}): TThrow extends false
  ? StartStorageContext | undefined
  : StartStorageContext {
  const context = startStorage.getStore()
  if (!context && opts?.throwIfNotFound !== false) {
    throw new Error(
      `No Start context found in AsyncLocalStorage. Make sure you are using the function within the server runtime.`,
    )
  }
  return context as any
}
