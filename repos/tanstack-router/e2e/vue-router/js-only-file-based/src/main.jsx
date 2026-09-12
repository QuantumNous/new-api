import { RouterProvider, createRouter } from '@tanstack/vue-router'
import { routeTree } from './routeTree.gen'
import { createApp } from 'vue'
import './styles.css'

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultStaleTime: 5000,
  scrollRestoration: true,
})

const rootElement = document.getElementById('app')

if (!rootElement.innerHTML) {
  createApp({
    setup() {
      return () => <RouterProvider router={router} />
    },
  }).mount('#app')
}
