import { createRouter } from '@tanstack/vue-router'
import { routeTree } from './routeTree.gen'

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
  })

  return router
}

declare module '@tanstack/vue-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
