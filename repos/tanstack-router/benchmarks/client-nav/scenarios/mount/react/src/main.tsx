import {
  RouterProvider,
  createBrowserHistory,
  createRouter,
} from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { routeTree } from './routeTree.gen'
import type { RouterHistory } from '@tanstack/react-router'

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

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createTestRouter>
  }
}

export function mountTestApp(container: HTMLElement) {
  const history = createBrowserHistory()
  const router = createTestRouter(history)

  const reactRoot = createRoot(container)
  reactRoot.render(<RouterProvider router={router} />)

  return {
    router,
    unmount() {
      reactRoot.unmount()
      history.destroy()
    },
  }
}
