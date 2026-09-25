import { createApp, h } from 'vue'
import { RouterProvider, createRouter } from '@tanstack/vue-router'
import { routeTree } from './routeTree.gen'

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultStaleTime: 5000,
  scrollRestoration: true,
  basepath: '/app/',
})

// Register things for typesafety
declare module '@tanstack/vue-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const app = createApp({
    setup() {
      return () => h(RouterProvider, { router })
    },
  })
  app.mount('#app')
}
