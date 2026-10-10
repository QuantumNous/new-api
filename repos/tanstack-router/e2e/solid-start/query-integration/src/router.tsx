import { QueryClient } from '@tanstack/solid-query'
import { createRouter } from '@tanstack/solid-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/solid-router-ssr-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
  })
  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  })
  return router
}
