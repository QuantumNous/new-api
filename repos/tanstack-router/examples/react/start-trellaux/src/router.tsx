import {
  MutationCache,
  QueryClient,
  notifyManager,
} from '@tanstack/react-query'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import toast from 'react-hot-toast'
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { DefaultCatchBoundary } from './components/DefaultCatchBoundary'
import { NotFound } from './components/NotFound'

export function getRouter() {
  if (typeof document !== 'undefined') {
    notifyManager.setScheduler(window.requestAnimationFrame)
  }

  const queryClient: QueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnReconnect: () => !queryClient.isMutating(),
      },
    },
    mutationCache: new MutationCache({
      onError: (error) => {
        toast(error.message, { className: 'bg-red-500 text-white' })
      },
      onSettled: () => {
        if (queryClient.isMutating() === 1) {
          return queryClient.invalidateQueries()
        }
      },
    }),
  })

  const router = createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultErrorComponent: DefaultCatchBoundary,
    defaultNotFoundComponent: () => <NotFound />,
    scrollRestoration: true,
    context: {
      queryClient,
    },
  })
  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
