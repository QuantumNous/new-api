import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    scrollToTopSelectors: ['[data-scroll-restoration-id="carry-over-reset"]'],
    getScrollRestorationKey: (location) => {
      if (location.pathname === '/ssr-scroll-key') {
        return 'ssr-scroll-key'
      }

      if (location.pathname === '/hash-scroll-repro') {
        return location.pathname
      }

      return location.state.__TSR_key! || location.href
    },
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
  })

  return router
}
