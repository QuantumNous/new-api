import { render } from 'solid-js/web'
import { RouterProvider, createRouter } from '@tanstack/solid-router'
import { trpc } from './trpc'

import { Spinner } from './routes/-components/spinner'
import './styles.css'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Create a router instance
const router = createRouter({
  routeTree,
  scrollRestoration: true,
  defaultPreload: 'intent',
  defaultPendingComponent: () => (
    <div class={`p-2 text-2xl`}>
      <Spinner />
    </div>
  ),
  context: {
    trpc,
  },
})

// Register the router instance for type safety
declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('root')!

if (!rootElement.innerHTML) {
  render(() => <RouterProvider router={router} />, rootElement)
}
