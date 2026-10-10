import { render } from 'solid-js/web'
import { RouterProvider, createRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')
if (!rootElement) {
  throw new Error('Root element `#app` not found')
}
if (!rootElement.innerHTML) {
  render(() => <RouterProvider router={router} />, rootElement)
}
