import { RouterProvider, createRouter } from '@tanstack/vue-router'
import { createApp } from 'vue'
import { routeTree } from './routeTree.gen'
import './styles.css'

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultStaleTime: 5000,
  scrollRestoration: true,
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
  }).mount('#app')
}
