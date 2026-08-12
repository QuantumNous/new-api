import { render } from 'solid-js/web'
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useElementScrollRestoration,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import { createVirtualizer } from '@tanstack/solid-virtual'
import './styles.css'

const rootRoute = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <div class="p-2 flex gap-2 sticky top-0 border-b bg-gray-100 dark:bg-gray-900">
        <Link to="/" class="[&.active]:font-bold">
          Home
        </Link>{' '}
        <Link to="/about" class="[&.active]:font-bold">
          About
        </Link>
        <Link to="/about" resetScroll={false}>
          About (No Reset)
        </Link>
        <Link to="/by-element" class="[&.active]:font-bold">
          By-Element
        </Link>
      </div>
      <Outlet />
      <TanStackRouterDevtools />
    </>
  )
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: () => new Promise<void>((r) => setTimeout(r, 500)),
  component: IndexComponent,
})

function IndexComponent() {
  return (
    <div class="p-2">
      <h3>Welcome Home!</h3>
      <div class="space-y-2">
        {Array.from({ length: 50 }).map((_, i) => (
          <div class="h-[100px] p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border">
            Home Item {i + 1}
          </div>
        ))}
      </div>
    </div>
  )
}

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  loader: () => new Promise<void>((r) => setTimeout(r, 500)),
  component: AboutComponent,
})

function AboutComponent() {
  return (
    <div class="p-2">
      <div>Hello from About!</div>
      <div class="space-y-2">
        {Array.from({ length: 50 }).map((_, i) => (
          <div class="h-[100px] p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border">
            About Item {i + 1}
          </div>
        ))}
      </div>
    </div>
  )
}

const byElementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/by-element',
  loader: () => new Promise<void>((r) => setTimeout(r, 500)),
  component: ByElementComponent,
})

function ByElementComponent() {
  // We need a unique ID for manual scroll restoration on a specific element
  // It should be as unique as possible for this element across your app
  const scrollRestorationId = 'myVirtualizedContent'

  // We use that ID to get the scroll entry for this element
  const scrollEntry = useElementScrollRestoration({
    id: scrollRestorationId,
  })

  // Let's use TanStack Virtual to virtualize some content!
  let virtualizerParentRef: any
  const virtualizer = createVirtualizer({
    count: 10000,
    getScrollElement: () => virtualizerParentRef,
    estimateSize: () => 100,
    // We pass the scrollY from the scroll restoration entry to the virtualizer
    // as the initial offset
    initialOffset: scrollEntry?.scrollY,
  })

  return (
    <div class="p-2 h-[calc(100vh-41px)] flex flex-col">
      <div>Hello from By-Element!</div>
      <div class="h-full min-h-0 flex gap-4">
        <div class="border rounded-lg p-2 overflow-auto flex-1 space-y-2">
          {Array.from({ length: 50 }).map((_, i) => (
            <div class="h-[100px] p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border">
              About Item {i + 1}
            </div>
          ))}
        </div>
        <div class="flex-1 overflow-auto flex flex-col gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div class="flex-1 border rounded-lg p-2 overflow-auto">
              <div class="space-y-2">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div class="h-[100px] p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border">
                    About Item {i + 1}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div class="flex-1 flex flex-col min-h-0">
            <div class="font-bold">Virtualized</div>
            <div
              ref={virtualizerParentRef}
              // We pass the scroll restoration ID to the element
              // as a custom attribute that will get picked up by the
              // scroll restoration watcher
              data-scroll-restoration-id={scrollRestorationId}
              class="flex-1 border rounded-lg overflow-auto relative"
            >
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                }}
              >
                {virtualizer.getVirtualItems().map((item) => (
                  <div
                    class="absolute p-2 pb-0 w-full"
                    style={{
                      height: item.size + 'px',
                      top: item.start + 'px',
                    }}
                  >
                    <div class="p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border h-full">
                      Virtualized Item {item.index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  byElementRoute,
])

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  render(() => <RouterProvider router={router} />, rootElement)
}
