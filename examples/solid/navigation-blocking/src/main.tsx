import { createSignal } from 'solid-js'
import { render } from 'solid-js/web'
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useBlocker,
} from '@tanstack/solid-router'
import { TanStackRouterDevtools } from '@tanstack/solid-router-devtools'
import './styles.css'

const rootRoute = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  // block going from editor-1 to /foo/123?hello=world
  const blocker = useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (
        current.routeId === '/editor-1' &&
        next.fullPath === '/foo/$id' &&
        next.params.id === '123' &&
        next.search.hello === 'world'
      ) {
        return true
      }
      return false
    },
    enableBeforeUnload: false,
    withResolver: true,
  })

  return (
    <>
      <div class="p-2 flex gap-2 text-lg">
        <Link
          to="/"
          activeProps={{
            class: 'font-bold',
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>{' '}
        <Link
          to="/editor-1"
          activeProps={{
            class: 'font-bold',
          }}
        >
          Editor 1
        </Link>{' '}
        <Link
          to={'/editor-1/editor-2'}
          activeProps={{
            class: 'font-bold',
          }}
        >
          Editor 2
        </Link>{' '}
        <Link
          to="/foo/$id"
          params={{ id: '123' }}
          search={{ hello: 'world' }}
          activeProps={{
            class: 'font-bold',
          }}
          activeOptions={{ exact: true, includeSearch: true }}
        >
          foo 123
        </Link>{' '}
        <Link
          to="/foo/$id"
          params={{ id: '456' }}
          search={{ hello: 'universe' }}
          activeProps={{
            class: 'font-bold',
          }}
          activeOptions={{ exact: true, includeSearch: true }}
        >
          foo 456
        </Link>{' '}
      </div>
      <hr />

      {blocker().status === 'blocked' && (
        <div class="mt-2">
          <div>
            Are you sure you want to leave editor 1 for /foo/123?hello=world ?
          </div>
          <button
            class="bg-lime-500 text-white rounded-sm p-1 px-2 mr-2"
            onClick={blocker().proceed}
          >
            YES
          </button>
          <button
            class="bg-red-500 text-white rounded-sm p-1 px-2"
            onClick={blocker().reset}
          >
            NO
          </button>
        </div>
      )}
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

const fooRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'foo/$id',
  validateSearch: (search) => ({ hello: search.hello }) as { hello: string },
  component: () => <>foo {fooRoute.useParams()().id}</>,
})

const editor1Route = createRoute({
  getParentRoute: () => rootRoute,
  path: 'editor-1',
  component: Editor1Component,
})

function Editor1Component() {
  const [value, setValue] = createSignal('')

  // Block leaving editor-1 if there is text in the input
  const blocker = useBlocker({
    shouldBlockFn: () => value() !== '',
    enableBeforeUnload: () => value() !== '',
    withResolver: true,
  })

  return (
    <div class="flex flex-col p-2">
      <h3>Editor 1</h3>
      <div>
        <input
          value={value()}
          onInput={(e) => setValue(e.currentTarget.value)}
          class="border"
        />
      </div>
      <hr class="m-2" />
      <Link to="/editor-1/editor-2">Go to Editor 2</Link>
      <Outlet />

      {blocker().status === 'blocked' && (
        <div class="mt-2">
          <div>Are you sure you want to leave editor 1?</div>
          <div>
            You are going from {blocker().current?.pathname} to{' '}
            {blocker().next?.pathname}
          </div>
          <button
            class="bg-lime-500 text-white rounded-sm p-1 px-2 mr-2"
            onClick={blocker().proceed}
          >
            YES
          </button>
          <button
            class="bg-red-500 text-white rounded-sm p-1 px-2"
            onClick={blocker().reset}
          >
            NO
          </button>
        </div>
      )}
    </div>
  )
}

const editor2Route = createRoute({
  getParentRoute: () => editor1Route,
  path: 'editor-2',
  component: Editor2Component,
})

function Editor2Component() {
  const [value, setValue] = createSignal('')

  return (
    <div class="p-2">
      <h3>Editor 2</h3>
      <input
        value={value()}
        onInput={(e) => setValue(e.currentTarget.value)}
        class="border"
      />
    </div>
  )
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  fooRoute,
  editor1Route.addChildren([editor2Route]),
])

// Set up a Router instance
const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  scrollRestoration: true,
})

const rootElement = document.getElementById('app')!

if (!rootElement.innerHTML) {
  render(() => <RouterProvider router={router} />, rootElement)
}
