import { render } from 'solid-js/web'
import { RouterProvider, createRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'

export function createTestRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    // Key the scroll-restoration cache by pathname instead of the default
    // random per-entry location key: with push navigations the default mints
    // a fresh key per navigation and the module-level cache grows one entry
    // per push for the whole run, which is non-stationary.
    getScrollRestorationKey: (location) => location.pathname,
    defaultPreload: 'intent',
    defaultPreloadDelay: 0,
    defaultPreloadStaleTime: 0,
  })
}

declare module '@tanstack/solid-router' {
  interface Register {
    router: ReturnType<typeof createTestRouter>
  }
}

export function mountTestApp(container: HTMLElement) {
  const router = createTestRouter()

  const unmount = render(() => <RouterProvider router={router} />, container)

  return {
    router,
    unmount,
  }
}
