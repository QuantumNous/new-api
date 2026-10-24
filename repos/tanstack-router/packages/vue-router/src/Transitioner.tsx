import * as Vue from 'vue'
import { getLocationChangeInfo, trimPathRight } from '@tanstack/router-core'
import { isServer } from '@tanstack/router-core/isServer'
import { batch, useStore } from '@tanstack/vue-store'
import { useRouter } from './useRouter'
import { usePrevious } from './utils'

// Track mount state per router to avoid double-loading
let mountLoadForRouter = { router: null as any, mounted: false }

/**
 * Composable that sets up router transition logic.
 * This is called from MatchesContent to set up:
 * - router.startTransition
 * - router.startViewTransition
 * - History subscription
 * - Router event watchers
 *
 * Must be called during component setup phase.
 */
export function useTransitionerSetup() {
  const router = useRouter()

  // Skip on server - no transitions needed
  if (isServer ?? router.isServer) {
    return
  }

  const isLoading = useStore(router.stores.isLoading, (value) => value)

  // Track if we're in a transition - using a ref to track async transitions
  const isTransitioning = Vue.ref(false)

  // Track pending state changes
  const hasPending = useStore(router.stores.hasPending, (value) => value)

  const previousIsLoading = usePrevious(() => isLoading.value)

  const isAnyPending = Vue.computed(
    () => isLoading.value || isTransitioning.value || hasPending.value,
  )
  const previousIsAnyPending = usePrevious(() => isAnyPending.value)

  const isPagePending = Vue.computed(() => isLoading.value || hasPending.value)
  const previousIsPagePending = usePrevious(() => isPagePending.value)

  // Implement startTransition similar to React/Solid
  // Vue doesn't have a native useTransition like React 18, so we simulate it
  // We also update the router state's isTransitioning flag so useMatch can check it
  router.startTransition = (fn: () => void | Promise<void>) => {
    isTransitioning.value = true
    // Also update the router state so useMatch knows we're transitioning
    try {
      router.stores.isTransitioning.set(true)
    } catch {
      // Ignore errors if component is unmounted
    }

    // Helper to end the transition
    const endTransition = () => {
      // Use nextTick to ensure Vue has processed all reactive updates
      Vue.nextTick(() => {
        try {
          isTransitioning.value = false
          router.stores.isTransitioning.set(false)
        } catch {
          // Ignore errors if component is unmounted
        }
      })
    }

    // Execute the function synchronously
    // The function internally may call startViewTransition which schedules async work
    // via document.startViewTransition, but we don't need to wait for it here
    // because Vue's reactivity will trigger re-renders when state changes
    fn()

    // End the transition on next tick to allow Vue to process reactive updates
    endTransition()
  }

  // Vue updates DOM asynchronously (next tick). The View Transitions API expects the
  // update callback promise to resolve only after the DOM has been updated.
  // Wrap the router-core implementation to await a Vue flush before resolving.
  const originalStartViewTransition:
    | undefined
    | ((fn: () => Promise<void>) => void) =
    (router as any).__tsrOriginalStartViewTransition ??
    router.startViewTransition

  ;(router as any).__tsrOriginalStartViewTransition =
    originalStartViewTransition

  router.startViewTransition = (fn: () => Promise<void>) => {
    return originalStartViewTransition?.(async () => {
      await fn()
      await Vue.nextTick()
    })
  }

  // Subscribe to location changes
  // and try to load the new location
  let unsubscribe: (() => void) | undefined

  Vue.onMounted(() => {
    unsubscribe = router.history.subscribe(router.load)

    const nextLocation = router.buildLocation({
      to: router.latestLocation.pathname,
      search: true,
      params: true,
      hash: true,
      state: true,
      _includeValidateSearch: true,
    })

    // Check if the current URL matches the canonical form.
    // Compare publicHref (browser-facing URL) for consistency with
    // the server-side redirect check in router.beforeLoad.
    if (
      trimPathRight(router.latestLocation.publicHref) !==
      trimPathRight(nextLocation.publicHref)
    ) {
      router.commitLocation({ ...nextLocation, replace: true })
    }
  })

  // Track if component is mounted to prevent updates after unmount
  const isMounted = Vue.ref(false)

  Vue.onMounted(() => {
    isMounted.value = true
    if (!isAnyPending.value) {
      if (router.stores.status.get() === 'pending') {
        batch(() => {
          router.stores.status.set('idle')
          router.stores.resolvedLocation.set(router.stores.location.get())
        })
      }
    }
  })

  Vue.onUnmounted(() => {
    isMounted.value = false
    if (unsubscribe) {
      unsubscribe()
    }
  })

  // Try to load the initial location
  Vue.onMounted(() => {
    if (
      (typeof window !== 'undefined' && router.ssr) ||
      (mountLoadForRouter.router === router && mountLoadForRouter.mounted)
    ) {
      return
    }
    mountLoadForRouter = { router, mounted: true }
    const tryLoad = async () => {
      try {
        await router.load()
      } catch (err) {
        console.error(err)
      }
    }
    tryLoad()
  })

  // Setup watchers for emitting events
  // All watchers check isMounted to prevent updates after unmount
  Vue.watch(
    () => isLoading.value,
    (newValue) => {
      if (!isMounted.value) return
      try {
        if (previousIsLoading.value.previous && !newValue) {
          router.emit({
            type: 'onLoad',
            ...getLocationChangeInfo(
              router.stores.location.get(),
              router.stores.resolvedLocation.get(),
            ),
          })
        }
      } catch {
        // Ignore errors if component is unmounted
      }
    },
  )

  Vue.watch(isPagePending, (newValue) => {
    if (!isMounted.value) return
    try {
      // emit onBeforeRouteMount
      if (previousIsPagePending.value.previous && !newValue) {
        router.emit({
          type: 'onBeforeRouteMount',
          ...getLocationChangeInfo(
            router.stores.location.get(),
            router.stores.resolvedLocation.get(),
          ),
        })
      }
    } catch {
      // Ignore errors if component is unmounted
    }
  })

  Vue.watch(isAnyPending, (newValue) => {
    if (!isMounted.value) return
    try {
      if (!newValue && router.stores.status.get() === 'pending') {
        batch(() => {
          router.stores.status.set('idle')
          router.stores.resolvedLocation.set(router.stores.location.get())
        })
      }

      // The router was pending and now it's not
      if (previousIsAnyPending.value.previous && !newValue) {
        const changeInfo = getLocationChangeInfo(
          router.stores.location.get(),
          router.stores.resolvedLocation.get(),
        )
        router.emit({
          type: 'onResolved',
          ...changeInfo,
        })
      }
    } catch {
      // Ignore errors if component is unmounted
    }
  })
}

/**
 * @deprecated Use useTransitionerSetup() composable instead.
 * This component is kept for backwards compatibility but the setup logic
 * has been moved to useTransitionerSetup() for better SSR hydration.
 */
export const Transitioner = Vue.defineComponent({
  name: 'Transitioner',
  setup() {
    useTransitionerSetup()
    return () => null
  },
})
