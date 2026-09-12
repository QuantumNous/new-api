import { createRouter } from '@tanstack/vue-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  })

  return router
}

declare module '@tanstack/vue-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
