import { createApp } from 'vue'

import { tanstackRouterBrowserTracingIntegration } from '@sentry/vue/tanstackrouter'
import * as Sentry from '@sentry/vue'

import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/vue-router'
import { TanStackRouterDevtools } from '@tanstack/vue-router-devtools'
import './styles.css'

const rootRoute = createRootRoute({
  component: RootComponent,
  notFoundComponent: () => {
    return (
      <div>
        <p>This is the notFoundComponent configured on root route</p>
        <Link to="/">Start Over</Link>
      </div>
    )
  },
})

function RootComponent() {
  return (
    <>
      <div class="p-2 flex gap-2 text-lg border-b">
        <Link
          to="/"
          activeProps={{
            class: 'font-bold',
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>
      </div>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div class="p-2">
      <h3>Welcome Home!</h3>
    </div>
  )
}

const routeTree = rootRoute.addChildren([indexRoute])

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultStaleTime: 5000,
})

// Register things for typesafety
declare module '@tanstack/vue-router' {
  interface Register {
    router: typeof router
  }
}

Sentry.init({
  dsn: 'https://examplePublicKey@o0.ingest.sentry.io/0',
  integrations: [tanstackRouterBrowserTracingIntegration(router)],
  transport: () => ({
    send: (): Promise<any> => Promise.resolve(),
    flush: () => Promise.resolve(true),
  }),
  tracesSampleRate: 0.2,
  sendClientReports: false,
})

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  createApp({
    setup() {
      return () => <RouterProvider router={router} />
    },
  }).mount('#app')
}
