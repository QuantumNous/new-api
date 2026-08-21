import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    scrollToTopSelectors: [
      '[data-scroll-restoration-id="carry-over-reset"]',
      '#hash-scroll-nested',
      '#hash-scroll-reset-target',
      '#issue-7687-reset-probe',
      '#issue-7687-scroller',
      () =>
        typeof document === 'undefined'
          ? undefined
          : document.getElementById('issue-7687-stale-selector'),
      '#ssr-scroll-key-nested',
    ],
    getScrollRestorationKey: (location) => {
      if (location.pathname === '/ssr-scroll-key') {
        return 'ssr-scroll-key'
      }

      if (location.pathname === '/hash-scroll-repro') {
        const scrollKey =
          'scrollKey' in location.search ? location.search.scrollKey : undefined
        return typeof scrollKey === 'string'
          ? `${location.pathname}:${scrollKey}`
          : location.pathname
      }

      if (location.pathname.startsWith('/issue-7687')) {
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
