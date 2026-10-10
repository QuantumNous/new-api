import { RouterProvider, createRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'
import { render } from 'solid-js/web'
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
  render(() => <RouterProvider router={router} />, rootElement)
}
