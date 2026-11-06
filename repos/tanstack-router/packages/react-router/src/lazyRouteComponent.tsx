import * as React from 'react'
import { isModuleNotFoundError } from '@tanstack/router-core'
import { reactUse } from './utils'
import type { AsyncRouteComponent } from './route'

/**
 * Wrap a dynamic import to create a route component that supports
 * `.preload()` and friendly reload-on-module-missing behavior.
 *
 * @param importer Function returning a module promise
 * @param exportName Named export to use (default: `default`)
 * @returns A lazy route component compatible with TanStack Router
 * @link https://tanstack.com/router/latest/docs/framework/react/api/router/lazyRouteComponentFunction
 */
export function lazyRouteComponent<
  T extends Record<string, any>,
  TKey extends keyof T = 'default',
>(
  importer: () => Promise<T>,
  exportName?: TKey,
): T[TKey] extends (props: infer TProps) => any
  ? AsyncRouteComponent<TProps>
  : never {
  let loadPromise: Promise<any> | undefined
  let comp: T[TKey] | T['default']
  let error: any
  let reload: boolean

  const load = () => {
    if (!loadPromise) {
      loadPromise = importer()
        .then((res) => {
          loadPromise = undefined
          comp = res[exportName ?? 'default']
        })
        .catch((err) => {
          // We don't want an error thrown from preload in this case, because
          // there's nothing we want to do about module not found during preload.
          // Record the error, the rest is handled during the render path.
          error = err
          // If the load fails due to module not found, it may mean a new version of
          // the build was deployed and the user's browser is still using an old version.
          // If this happens, the old version in the user's browser would have an outdated
          // URL to the lazy module.
          // In that case, we want to attempt one window refresh to get the latest.
          if (isModuleNotFoundError(error)) {
            if (
              error instanceof Error &&
              typeof window !== 'undefined' &&
              typeof sessionStorage !== 'undefined'
            ) {
              // Again, we want to reload one time on module not found error and not enter
              // a reload loop if there is some other issue besides an old deploy.
              // That's why we store our reload attempt in sessionStorage.
              // Use error.message as key because it contains the module path that failed.
              const storageKey = `tanstack_router_reload:${error.message}`
              if (!sessionStorage.getItem(storageKey)) {
                sessionStorage.setItem(storageKey, '1')
                reload = true
              }
            }
          }
        })
    }

    return loadPromise
  }

  const lazyComp = function Lazy(props: any) {
    // Now that we're out of preload and into actual render path,
    if (reload) {
      // If it was a module loading error,
      // throw eternal suspense while we wait for window to reload
      window.location.reload()
      throw new Promise(() => {})
    }
    if (error) {
      // Otherwise, just throw the error
      throw error
    }

    if (!comp) {
      if (reactUse) {
        reactUse(load())
      } else {
        throw load()
      }
    }

    return React.createElement(comp, props)
  }

  ;(lazyComp as any).preload = load

  return lazyComp as any
}
