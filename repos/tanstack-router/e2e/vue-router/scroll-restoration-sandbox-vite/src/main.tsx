import { createApp } from 'vue'
import {
  RouterProvider,
  createHashHistory,
  createRouter,
} from '@tanstack/vue-router'
import { routeTree } from './routeTree.gen'
import type { RouterHistory } from '@tanstack/vue-router'
import './styles.css'

let history: RouterHistory | undefined

if (import.meta.env.VITE_APP_HISTORY === 'hash') {
  history = createHashHistory()
}

// Set up a Router instance
const router = createRouter({
  routeTree,
  history,
  scrollRestoration: true,
})

// Register things for typesafety
declare module '@tanstack/vue-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')

if (!rootElement?.innerHTML) {
  createApp({
    setup() {
      return () => <RouterProvider router={router} />
    },
  }).mount('#app')
}
