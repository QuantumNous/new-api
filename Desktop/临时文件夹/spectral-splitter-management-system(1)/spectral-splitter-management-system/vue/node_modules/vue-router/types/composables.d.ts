import type { ComputedRef, Ref } from 'vue'
import type { Route, NavigationGuard, default as VueRouter } from './index'

/**
 * Returns the current route location. Equivalent to using `$route` inside templates.
 */
export function useRoute(): Route

/**
 * Returns the router instance. Equivalent to using `$router` inside templates.
 */
export function useRouter(): VueRouter

/**
 * Add a navigation guard that triggers whenever the current location is about to be updated. Similar to beforeRouteUpdate but can be used in any component. The guard is removed when the component is unmounted.
 *
 * @param updateGuard
 */
export function onBeforeRouteUpdate(updateGuard: NavigationGuard): void

/**
 * Add a navigation guard that triggers whenever the component for the current location is about to be left. Similar to beforeRouteLeave but can be used in any component. The guard is removed when the component is unmounted.
 *
 * @param leaveGuard
 */
export function onBeforeRouteLeave(leaveGuard: NavigationGuard): void

export interface RouterLinkOptions {
  /**
   * Route Location the link should navigate to when clicked on.
   */
  to: Route | Ref<Route>
  /**
   * Calls `router.replace` instead of `router.push`.
   */
  replace?: boolean
}

/**
 * Vue Router 4 `useLink()` function. Note the active behavior is different from Vue Router 3 as highlighted in the
 * migration guide (https://router.vuejs.org/guide/migration/index.html#removal-of-the-exact-prop-in-router-link)
 *
 * @param props - object containing a `to` property with the location
 */
export function useLink({ to, replace }: RouterLinkOptions): {
  route: ComputedRef<Route>,
  isActive: ComputedRef<boolean>,
  isExactActive: ComputedRef<boolean>,
  href: ComputedRef<string>,
  navigate: () => Promise<void>,
}
