import { RouterProvider, createRouter } from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { routeTree } from './routeTree.gen'
import { basepath, localeRewrite } from '../../shared'

export function createTestRouter() {
  return createRouter({
    routeTree,
    basepath,
    rewrite: localeRewrite,
    scrollRestoration: true,
    // Key the scroll-restoration cache by pathname instead of the default
    // random per-entry location key: with push navigations the default mints
    // a fresh key per navigation and the module-level cache grows one entry
    // per push for the whole run, which is non-stationary.
    getScrollRestorationKey: (location) => location.pathname,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createTestRouter>
  }
}

export function mountTestApp(container: HTMLElement) {
  const router = createTestRouter()

  const reactRoot = createRoot(container)
  reactRoot.render(<RouterProvider router={router} />)

  return {
    router,
    unmount() {
      reactRoot.unmount()
    },
  }
}
