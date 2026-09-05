import * as Vue from 'vue'
import {
  RouterProvider,
  createBrowserHistory,
  createRouter,
} from '@tanstack/vue-router'
import { routeTree } from './routeTree.gen'
import type { RouterHistory } from '@tanstack/vue-router'

/**
 * Unlike the other scenarios, this app is mounted and unmounted in a loop, so
 * it must not register page-lifetime globals that have no dispose path:
 * - the history is created explicitly and `destroy()`ed on unmount — the
 *   default per-router `createBrowserHistory()` monkey-patches
 *   `window.history.pushState`/`replaceState`, chaining one wrapper per
 *   router and degrading every later mount;
 * - `scrollRestoration` stays off — enabling it registers per-router
 *   document/window listeners that retain every router ever created.
 */
export function createTestRouter(history: RouterHistory) {
  return createRouter({
    routeTree,
    history,
  })
}

declare module '@tanstack/vue-router' {
  interface Register {
    router: ReturnType<typeof createTestRouter>
  }
}

export function mountTestApp(container: HTMLElement) {
  const history = createBrowserHistory()
  const router = createTestRouter(history)

  const component = <RouterProvider router={router} />
  const app = Vue.createApp({
    render: () => component,
  })

  app.mount(container)

  return {
    router,
    unmount() {
      app.unmount()
      history.destroy()
    },
  }
}
