import * as Vue from 'vue'
import { Outlet } from './Match'
import { ClientOnly } from './ClientOnly'
import type { AsyncRouteComponent } from './route'

// If the load fails due to module not found, it may mean a new version of
// the build was deployed and the user's browser is still using an old version.
// If this happens, the old version in the user's browser would have an outdated
// URL to the lazy module.
// In that case, we want to attempt one window refresh to get the latest.
function isModuleNotFoundError(error: any): boolean {
  // chrome: "Failed to fetch dynamically imported module: http://localhost:5173/src/routes/posts.index.tsx?tsr-split"
  // firefox: "error loading dynamically imported module: http://localhost:5173/src/routes/posts.index.tsx?tsr-split"
  // safari: "Importing a module script failed."
  if (typeof error?.message !== 'string') return false
  return (
    error.message.startsWith('Failed to fetch dynamically imported module') ||
    error.message.startsWith('error loading dynamically imported module') ||
    error.message.startsWith('Importing a module script failed')
  )
}

export function lazyRouteComponent<
  T extends Record<string, any>,
  TKey extends keyof T = 'default',
>(
  importer: () => Promise<T>,
  exportName?: TKey,
  ssr?: () => boolean,
): T[TKey] extends (props: infer TProps) => any
  ? AsyncRouteComponent<TProps>
  : never {
  let loadPromise: Promise<any> | undefined
  let comp: T[TKey] | T['default'] | null = null
  let error: any = null
  let attemptedReload = false

  const load = () => {
    // If we're on the server and SSR is disabled for this component
    if (typeof document === 'undefined' && ssr?.() === false) {
      comp = (() => null) as any
      return Promise.resolve(comp)
    }

    // Use existing promise or create new one
    if (!loadPromise) {
      loadPromise = importer()
        .then((res) => {
          loadPromise = undefined
          comp = res[exportName ?? 'default']
          return comp
        })
        .catch((err) => {
          error = err
          loadPromise = undefined

          // If it's a module not found error, we'll try to handle it in the component
          if (isModuleNotFoundError(error)) {
            return null
          }

          throw err
        })
    }

    return loadPromise
  }

  // Create a lazy component wrapper using defineComponent so it works in Vue SFC templates
  const lazyComp = Vue.defineComponent({
    name: 'LazyRouteComponent',
    setup(props: any) {
      // Create refs to track component state
      // Use shallowRef for component to avoid making it reactive (Vue warning)
      const component = Vue.shallowRef<any>(comp ? Vue.markRaw(comp) : comp)
      const errorState = Vue.ref<any>(error)
      const loading = Vue.ref(!component.value && !errorState.value)

      // Setup effect to load the component when this component is used
      Vue.onMounted(() => {
        if (!component.value && !errorState.value) {
          loading.value = true

          load()
            .then((result) => {
              // Use markRaw to prevent Vue from making the component reactive
              component.value = result ? Vue.markRaw(result) : result
              loading.value = false
            })
            .catch((err) => {
              errorState.value = err
              loading.value = false
            })
        }
      })

      // Handle module not found error with reload attempt
      if (
        errorState.value &&
        isModuleNotFoundError(errorState.value) &&
        !attemptedReload
      ) {
        if (
          typeof window !== 'undefined' &&
          typeof sessionStorage !== 'undefined'
        ) {
          // Try to reload once on module not found error
          const storageKey = `tanstack_router_reload:${errorState.value.message}`
          if (!sessionStorage.getItem(storageKey)) {
            sessionStorage.setItem(storageKey, '1')
            attemptedReload = true
            window.location.reload()
            return () => null // Return empty while reloading
          }
        }
      }

      // If we have a non-module-not-found error, throw it
      if (errorState.value && !isModuleNotFoundError(errorState.value)) {
        throw errorState.value
      }

      // Return a render function
      return () => {
        // If we're still loading or don't have a component yet, use a suspense pattern
        if (loading.value || !component.value) {
          return Vue.h('div', null) // Empty div while loading
        }

        // If SSR is disabled for this component
        if (ssr?.() === false) {
          return Vue.h(
            ClientOnly,
            {
              fallback: Vue.h(Outlet),
            },
            {
              default: () => Vue.h(component.value, props),
            },
          )
        }

        // Regular render with the loaded component
        return Vue.h(component.value, props)
      }
    },
  })

  // Add preload method
  lazyComp.preload = load

  return lazyComp as any
}
