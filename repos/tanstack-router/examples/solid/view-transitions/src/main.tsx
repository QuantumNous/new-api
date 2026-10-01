import { render } from 'solid-js/web'
import { RouterProvider, createRouter } from '@tanstack/solid-router'
import { routeTree } from './routeTree.gen'
import './styles.css'

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultStaleTime: 5000,
  scrollRestoration: true,
  /* 
  Using defaultViewTransition would prevent the need to
  manually add `viewTransition: true` to every navigation.

  If defaultViewTransition.types is a function, it will be called with the
  location change info and should return an array of view transition types.
  This is useful if you want to have different view transitions depending on
  the navigation's specifics.

  An example use case is sliding in a direction based on the index of the
  previous and next routes when navigating via browser history back and forth.
  */
  // defaultViewTransition: true
  // OR
  // defaultViewTransition: {
  //   types: ({ fromLocation, toLocation }) => {
  //     let direction = 'none'

  //     if (fromLocation) {
  //       const fromIndex = fromLocation.state.__TSR_index
  //       const toIndex = toLocation.state.__TSR_index

  //       direction = fromIndex > toIndex ? 'right' : 'left'
  //     }

  //     return [`slide-${direction}`]
  //   },
  // },
})

// Register things for typesafety
declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  render(() => <RouterProvider router={router} />, rootElement)
}
