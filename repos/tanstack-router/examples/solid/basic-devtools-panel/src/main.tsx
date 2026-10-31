import App from './App'
import {
  Outlet,
  RouterProvider,
  Link,
  createRouter,
  createRoute,
  createRootRoute,
} from '@tanstack/solid-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/solid-router-devtools'
import { render } from 'solid-js/web'

const rootRoute = createRootRoute({
  component: () => (
    <>
      <div class="p-2 flex gap-2">
        <Link to="/">Home</Link> <Link to="/about">About</Link>
      </div>
      <hr />
      <Outlet />
    </>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: function Index() {
    return (
      <div class="p-2">
        <h3>Welcome Home!</h3>
        <App />
      </div>
    )
  },
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  component: function About() {
    return <div class="p-2">Hello from About!</div>
  },
})

const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])

const router = createRouter({ routeTree })

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

const element = document.getElementById('app')!
const shadowContainer = element.attachShadow({ mode: 'open' })
const shadowRootElement = document.createElement('div')
shadowContainer.appendChild(shadowRootElement)

render(
  () => (
    <>
      <RouterProvider router={router} />
      <TanStackRouterDevtoolsPanel
        shadowDOMTarget={shadowContainer}
        router={router}
      />
    </>
  ),
  shadowRootElement,
)
