import { createApp, defineComponent, onMounted, ref } from 'vue'
import {
  HeadContent,
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useElementScrollRestoration,
} from '@tanstack/vue-router'
import { TanStackRouterDevtools } from '@tanstack/vue-router-devtools'
import { useVirtualizer } from '@tanstack/vue-virtual'
import './styles.css'

const rootRoute = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <>
      <HeadContent />
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

const IndexComponent = defineComponent({
  name: 'IndexComponent',
  setup() {
    onMounted(() => {
      window.invokeOrders.push('index-useLayoutEffect')
    })

    return () => (
      <div class="p-2">
        <h3 id="greeting" class="bg-red-600">
          Welcome Home!
        </h3>
        <div id="top-message" />
        <div class="space-y-2">
          {Array.from({ length: 50 }).map((_, i) => (
            <div class="h-[100px] p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border">
              Home Item {i + 1}
            </div>
          ))}
        </div>
      </div>
    )
  },
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  loader: () => new Promise<any>((r) => setTimeout(r, 500)),
  component: IndexComponent,
})

const AboutComponent = defineComponent({
  name: 'AboutComponent',
  setup() {
    onMounted(() => {
      window.invokeOrders.push('about-useLayoutEffect')
    })

    return () => (
      <div class="p-2">
        <h3 id="greeting">Hello from About!</h3>
        <div class="space-y-2">
          {Array.from({ length: 50 }).map((_, i) => (
            <div class="h-[100px] p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border">
              About Item {i + 1}
            </div>
          ))}
        </div>
      </div>
    )
  },
})

const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/about',
  loader: () => new Promise<any>((r) => setTimeout(r, 500)),
  component: AboutComponent,
})

const ByElementComponent = defineComponent({
  name: 'ByElementComponent',
  setup() {
    // We need a unique ID for manual scroll restoration on a specific element
    // It should be as unique as possible for this element across your app
    const scrollRestorationId = 'myVirtualizedContent'

    // We use that ID to get the scroll entry for this element
    const scrollEntry = useElementScrollRestoration({
      id: scrollRestorationId,
    })

    // Let's use TanStack Virtual to virtualize some content!
    const virtualizerParentRef = ref<HTMLDivElement | null>(null)
    const virtualizer = useVirtualizer({
      count: 10000,
      getScrollElement: () => virtualizerParentRef.value,
      estimateSize: () => 100,
      // We pass the scrollY from the scroll restoration entry to the virtualizer
      // as the initial offset
      initialOffset: scrollEntry?.scrollY,
    })

    return () => (
      <div class="p-2 h-[calc(100vh-41px)] flex flex-col">
        <div>Hello from By-Element!</div>
        <div class="h-full min-h-0 flex gap-4">
          <div
            id="RegularList"
            class="border rounded-lg p-2 overflow-auto flex-1 space-y-2"
          >
            <div class="h-[100px] p-2 rounded-lg bg-red-600 border">
              First Regular List Item
              <div id="first-regular-list-item" />
            </div>
            {Array.from({ length: 50 }).map((_, i) => (
              <div class="h-[100px] p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border">
                Regular List Item {i + 1}
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
                    height: `${virtualizer.value.getTotalSize()}px`,
                  }}
                >
                  {virtualizer.value.getVirtualItems().map((item) => (
                    <div
                      class="absolute p-2 pb-0 w-full"
                      style={{
                        height: item.size,
                        top: item.start,
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
  },
})

const byElementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/by-element',
  loader: () => new Promise<any>((r) => setTimeout(r, 500)),
  component: ByElementComponent,
})

const fooRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/foo',
  loader: () => new Promise<any>((r) => setTimeout(r, 500)),
  component: FooComponent,
})

function FooComponent() {
  return (
    <div data-testid="foo-route-component" class="p-2">
      <h3 id="greeting">Hello from Foo!</h3>
      <Link to="/bar" data-testid="go-to-bar-link">
        Go to Bar
      </Link>
      <div class="space-y-2">
        {Array.from({ length: 50 }).map((_, i) => (
          <div class="h-[100px] p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border">
            Foo Item {i + 1}
          </div>
        ))}
      </div>
    </div>
  )
}

const barRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/bar',
  loader: () => new Promise<any>((r) => setTimeout(r, 500)),
  component: BarComponent,
})

function BarComponent() {
  return (
    <div data-testid="bar-route-component" class="p-2">
      <h3 id="greeting">Hello from Bar!</h3>
      <div class="space-y-2">
        {Array.from({ length: 50 }).map((_, i) => (
          <div class="h-[100px] p-2 rounded-lg bg-gray-200 dark:bg-gray-800 border">
            Bar Item {i + 1}
          </div>
        ))}
      </div>
    </div>
  )
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  aboutRoute,
  byElementRoute,
  fooRoute,
  barRoute,
])

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
  getScrollRestorationKey: (location) => location.pathname,
})

declare global {
  interface Window {
    invokeOrders: Array<string>
  }
}

let invokeOrders: Array<string> = []
let shouldRecordRouterEvents = true

Object.defineProperty(window, 'invokeOrders', {
  configurable: true,
  get: () => invokeOrders,
  set: (next) => {
    invokeOrders = next
    // Tests reset this between navigations; ignore any in-flight events from
    // the previous navigation until the next navigation begins.
    shouldRecordRouterEvents = false
  },
})

router.subscribe('onBeforeLoad', () => {
  shouldRecordRouterEvents = true
})

router.subscribe('onBeforeRouteMount', (event) => {
  if (!shouldRecordRouterEvents) return
  invokeOrders.push(event.type)
})

router.subscribe('onResolved', (event) => {
  if (!shouldRecordRouterEvents) return
  invokeOrders.push(event.type)
})

declare module '@tanstack/vue-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  createApp({
    setup() {
      return () => <RouterProvider router={router} />
    },
  }).mount('#app')
}
