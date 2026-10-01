import { createRouter as createSolidRouter } from '@tanstack/solid-router'

import { routeTree } from './routeTree.gen'

export function createRouter() {
  return createSolidRouter({
    routeTree,
    defaultPreload: 'intent',
    scrollRestoration: true,
  })
}

declare module '@tanstack/solid-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
