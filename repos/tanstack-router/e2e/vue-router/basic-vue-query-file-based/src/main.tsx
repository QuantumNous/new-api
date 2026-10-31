import { createApp } from 'vue'
import { RouterProvider, createRouter } from '@tanstack/vue-router'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import { routeTree } from './routeTree.gen'
import './styles.css'

const queryClient = new QueryClient()

// Set up a Router instance
const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  scrollRestoration: true,
  defaultPreload: 'intent',
  // Since we're using Vue Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  defaultPreloadStaleTime: 0,
})

// Register things for typesafety
declare module '@tanstack/vue-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  createApp({
    setup() {
      return () => <RouterProvider router={router} />
    },
  })
    .use(VueQueryPlugin, { queryClient })
    .mount('#app')
}
