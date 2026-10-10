import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  RouterProvider,
  createRouteMask,
  createRouter,
} from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import './styles.css'

const mask = createRouteMask({
  routeTree,
  from: '/masks/admin/$userId',
  to: '/masks/public/$username',
  params: (prev) => ({
    username: `user-${prev.userId}`,
  }),
})

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultStaleTime: 5000,
  scrollRestoration: true,
  routeMasks: [mask],
})

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(<RouterProvider router={router} />)
}
