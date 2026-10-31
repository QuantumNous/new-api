import {
  HeadContent,
  Link,
  Outlet,
  createRootRoute,
  useCanGoBack,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({
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
  const router = useRouter()
  const canGoBack = useCanGoBack()
  // test useRouterState doesn't crash client side navigation
  const _state = useRouterState()

  return (
    <>
      <HeadContent />
      <div className="flex gap-2 p-2 text-lg border-b">
        <button
          data-testid="back-button"
          disabled={!canGoBack}
          onClick={() => router.history.back()}
          className={!canGoBack ? 'line-through' : undefined}
        >
          Back
        </button>{' '}
        <Link
          to="/"
          activeProps={{
            className: 'font-bold',
          }}
          activeOptions={{ exact: true }}
        >
          Home
        </Link>{' '}
        <Link
          to="/posts"
          activeProps={{
            className: 'font-bold',
          }}
        >
          Posts
        </Link>{' '}
        <Link
          to="/layout-a"
          activeProps={{
            className: 'font-bold',
          }}
        >
          Layout
        </Link>{' '}
        <Link
          to="/onlyrouteinside"
          data-testid="link-to-only-route-inside-group"
          search={{ hello: 'world' }}
          activeProps={{
            className: 'font-bold',
          }}
        >
          Only Route Inside Group
        </Link>{' '}
        <Link
          to="/inside"
          data-testid="link-to-route-inside-group"
          search={{ hello: 'world' }}
          activeProps={{
            className: 'font-bold',
          }}
        >
          Inside Group
        </Link>{' '}
        <Link
          to="/subfolder/inside"
          data-testid="link-to-route-inside-group-inside-subfolder"
          search={{ hello: 'world' }}
          activeProps={{
            className: 'font-bold',
          }}
        >
          Inside Subfolder Inside Group
        </Link>{' '}
        <Link
          to="/insidelayout"
          data-testid="link-to-route-inside-group-inside-layout"
          search={{ hello: 'world' }}
          activeProps={{
            className: 'font-bold',
          }}
        >
          Inside Group Inside Layout
        </Link>{' '}
        <Link
          to="/lazyinside"
          data-testid="link-to-lazy-route-inside-group"
          search={{ hello: 'world' }}
          activeProps={{
            className: 'font-bold',
          }}
        >
          Lazy Inside Group
        </Link>{' '}
        <Link
          to="/redirect"
          activeProps={{
            className: 'font-bold',
          }}
        >
          redirect
        </Link>{' '}
        <Link
          to="/relative"
          activeProps={{
            className: 'font-bold',
          }}
        >
          relative routing
        </Link>{' '}
        <Link
          to="/대한민국"
          activeProps={{
            className: 'font-bold',
          }}
        >
          unicode path
        </Link>{' '}
        <Link
          // @ts-expect-error
          to="/this-route-does-not-exist"
          activeProps={{
            className: 'font-bold',
          }}
        >
          This Route Does Not Exist
        </Link>{' '}
        <Link
          to="/masks"
          data-testid="link-to-masks"
          activeProps={{
            className: 'font-bold',
          }}
        >
          Masks
        </Link>{' '}
        <Link
          to="/pathless-layout"
          data-testid="link-to-pathless-layout"
          activeProps={{
            className: 'font-bold',
          }}
        >
          Pathless Layout
        </Link>{' '}
        <Link
          to="/fullpath-test"
          data-testid="link-to-fullpath-test"
          activeProps={{
            className: 'font-bold',
          }}
        >
          FullPath Test
        </Link>
      </div>
      <hr />
      <Outlet />
      {/* Start rendering router matches */}
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
