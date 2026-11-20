import * as Solid from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@solidjs/testing-library'

import { z } from 'zod'

import { trailingSlashOptions } from '@tanstack/router-core'
import {
  Link,
  Outlet,
  RouterProvider,
  createBrowserHistory,
  createHashHistory,
  createLink,
  createMemoryHistory,
  createRootRoute,
  createRootRouteWithContext,
  createRoute,
  createRouteMask,
  createRouter,
  getRouteApi,
  redirect,
  retainSearchParams,
  stripSearchParams,
  useLoaderData,
  useMatchRoute,
  useParams,
  useRouteContext,
  useSearch,
} from '../src'
import {
  getIntersectionObserverMock,
  getSearchParamsFromURI,
  sleep,
} from './utils'
import type { RouterHistory } from '../src'

const ioObserveMock = vi.fn()
const ioDisconnectMock = vi.fn()
let history: RouterHistory

beforeEach(() => {
  const io = getIntersectionObserverMock({
    observe: ioObserveMock,
    disconnect: ioDisconnectMock,
  })
  vi.stubGlobal('IntersectionObserver', io)
  history = createBrowserHistory()
  expect(window.location.pathname).toBe('/')
})

afterEach(() => {
  history.destroy?.()
  window.history.replaceState(null, 'root', '/')
  vi.resetAllMocks()
  cleanup()
})

const WAIT_TIME = 300

describe('Link', () => {
  // rerender doesn't exist in solid

  // test('when using renderHook it returns a hook with same content to prove rerender works', async () => {
  //   /**
  //    * This is the hook that will be testet.
  //    *
  //    * @returns custom state
  //    */
  //   const useLocationFromState = () => {
  //     const { location } = useRouterState()

  //     // could return anything just to prove it will work.
  //     const memoLocation = Solid.useMemo(() => {
  //       return {
  //         href: location.href,
  //         pathname: location.pathname,
  //       }
  //     }, [location.href, location.pathname])

  //     return memoLocation
  //   }

  //   const IndexComponent = ({ children }: { children: Solid.JSX.Element }) => {
  //     return <h1 data-testid="testId">{children}</h1>
  //   }
  //   const RouterContainer = ({ children }: { children: Solid.JSX.Element }) => {
  //     const childrenRef = Solid.useRef(children)
  //     const memoedRouteTree = Solid.useMemo(() => {
  //       const rootRoute = createRootRoute()
  //       const indexRoute = createRoute({
  //         getParentRoute: () => rootRoute,
  //         path: '/',
  //         component: () => (
  //           <IndexComponent>{childrenRef.current}</IndexComponent>
  //         ),
  //       })
  //       return rootRoute.addChildren([indexRoute])
  //     }, [])

  //     const memoedRouter = Solid.useMemo(() => {
  //       const router = createRouter({
  //         routeTree: memoedRouteTree,
  //       })

  //       return router
  //     }, [memoedRouteTree])
  //     return <RouterProvider router={memoedRouter} />
  //   }

  //   const { result, rerender } = renderHook(
  //     () => {
  //       return useLocationFromState()
  //     },
  //     { wrapper: RouterContainer },
  //   )
  //   await waitFor(() => expect(screen.getByTestId('testId')).toBeVisible())
  //   expect(result.current).toBeTruthy()

  //   const original = result.current

  //   rerender()

  //   await waitFor(() => expect(screen.getByTestId('testId')).toBeVisible())
  //   const updated = result.current

  //   expect(original).toBe(updated)
  // })

  test('when a Link is disabled', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <>
          <h1>Index</h1>
          <Link to="/posts" disabled>
            Posts
          </Link>
        </>
      ),
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => <h1>Posts</h1>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    expect(window.location.pathname).toBe('/')

    expect(postsLink).not.toBeDisabled()
    expect(postsLink).toHaveAttribute('aria-disabled', 'true')

    fireEvent.click(postsLink)

    await expect(
      screen.findByRole('header', { name: 'Posts' }),
    ).rejects.toThrow()
  })

  test('does not forward internal Link props to the DOM', async () => {
    const internalPropNames = [
      'activeProps',
      'inactiveProps',
      'activeOptions',
      'to',
      'from',
      'preload',
      'preloadDelay',
      'preloadIntentProximity',
      'hashScrollIntoView',
      'replace',
      'startTransition',
      'resetScroll',
      'viewTransition',
      'ignoreBlocker',
      'params',
      'search',
      'hash',
      'state',
      'mask',
      'reloadDocument',
      'unsafeRelative',
    ].map((propName) => propName.toLowerCase())

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <Link
          to="/posts"
          from="/"
          activeProps={{ class: 'active' }}
          inactiveProps={{ class: 'inactive' }}
          activeOptions={{
            exact: true,
            includeHash: true,
            includeSearch: true,
          }}
          preload="intent"
          preloadDelay={50}
          preloadIntentProximity={123}
          hashScrollIntoView={true}
          replace={true}
          startTransition={true}
          resetScroll={true}
          viewTransition={true}
          ignoreBlocker={true}
          params={{}}
          search={{ foo: 'bar' }}
          hash="details"
          state={{}}
          mask={{ to: '/posts', hash: 'masked' }}
          reloadDocument={true}
          unsafeRelative="path"
        >
          Posts
        </Link>
      ),
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => <h1>Posts</h1>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })
    const renderedAttributeNames = postsLink
      .getAttributeNames()
      .map((attributeName) => attributeName.toLowerCase())

    for (const propName of internalPropNames) {
      expect(renderedAttributeNames).not.toContain(propName)
    }
  })

  test('when a Link has children', async () => {
    const ChildComponent = vi.fn().mockReturnValue(<button>Posts</button>)
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <>
          <h1>Index</h1>
          <Link to="/posts">
            <ChildComponent />
          </Link>
        </>
      ),
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => <h1>Posts</h1>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    fireEvent.click(postsLink)

    const postsHeading = await screen.findByRole('heading', { name: 'Posts' })
    expect(postsHeading).toBeInTheDocument()

    expect(ChildComponent).toBeCalledTimes(1)
  })

  test('when the current route is the root', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/" activeProps={{ class: 'active' }}>
              Index
            </Link>
            <Link to="/posts" inactiveProps={{ class: 'inactive' }}>
              Posts
            </Link>
          </>
        )
      },
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => {
        return <h1>Posts</h1>
      },
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const indexLink = await screen.findByRole('link', { name: 'Index' })

    expect(window.location.pathname).toBe('/')

    expect(indexLink).toHaveAttribute('aria-current', 'page')
    expect(indexLink).toHaveClass('active')
    expect(indexLink).toHaveAttribute('data-status', 'active')
    expect(indexLink).toHaveAttribute('href', '/')

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    expect(postsLink).toHaveClass('inactive')
    expect(postsLink).toHaveAttribute('href', '/posts')
    expect(postsLink).not.toHaveAttribute('aria-current', 'page')
    expect(postsLink).not.toHaveAttribute('data-status', 'active')
  })

  describe('when the current route has a search fields with undefined values', () => {
    async function runTest(opts: { explicitUndefined: boolean | undefined }) {
      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => {
          return (
            <>
              <h1>Index</h1>
              <Link
                to="/"
                activeOptions={{ exact: true }}
                inactiveProps={{ class: 'inactive' }}
              >
                Index exact
              </Link>
              <Link
                to="/"
                search={{ foo: undefined }}
                inactiveProps={{ class: 'inactive' }}
                activeOptions={{ explicitUndefined: opts.explicitUndefined }}
              >
                Index foo=undefined
              </Link>
              <Link
                to="/"
                search={{ foo: undefined }}
                activeOptions={{
                  exact: true,
                  explicitUndefined: opts.explicitUndefined,
                }}
                inactiveProps={{ class: 'inactive' }}
              >
                Index foo=undefined-exact
              </Link>
              <Link
                to="/"
                search={{ foo: 'bar' }}
                inactiveProps={{
                  class: 'inactive',
                }}
              >
                Index foo=bar
              </Link>
            </>
          )
        },
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute]),
      })

      render(() => <RouterProvider router={router} />)

      // round 1
      const indexExactLink = await screen.findByRole('link', {
        name: 'Index exact',
      })

      const indexFooUndefinedLink = await screen.findByRole('link', {
        name: 'Index foo=undefined',
      })

      const indexFooUndefinedExactLink = await screen.findByRole('link', {
        name: 'Index foo=undefined-exact',
      })

      const indexFooBarLink = await screen.findByRole('link', {
        name: 'Index foo=bar',
      })

      expect(window.location.pathname).toBe('/')

      expect(indexExactLink).toHaveClass('active')
      expect(indexExactLink).not.toHaveClass('inactive')
      expect(indexExactLink).toHaveAttribute('href', '/')
      expect(indexExactLink).toHaveAttribute('aria-current', 'page')
      expect(indexExactLink).toHaveAttribute('data-status', 'active')

      if (opts.explicitUndefined) {
        expect(indexFooUndefinedLink).toHaveClass('active')
        expect(indexFooUndefinedLink).not.toHaveClass('inactive')
        expect(indexFooUndefinedLink).toHaveAttribute('aria-current', 'page')
        expect(indexFooUndefinedLink).toHaveAttribute('data-status', 'active')
      } else {
        expect(indexFooUndefinedLink).toHaveClass('active')
        expect(indexFooUndefinedLink).not.toHaveClass('inactive')
        expect(indexFooUndefinedLink).toHaveAttribute('aria-current', 'page')
        expect(indexFooUndefinedLink).toHaveAttribute('data-status', 'active')
      }

      expect(indexFooUndefinedLink).toHaveAttribute('href', '/')

      if (opts.explicitUndefined) {
        expect(indexFooUndefinedExactLink).not.toHaveClass('active')
        expect(indexFooUndefinedExactLink).toHaveClass('inactive')
        expect(indexFooUndefinedExactLink).not.toHaveAttribute(
          'aria-current',
          'page',
        )
        expect(indexFooUndefinedExactLink).not.toHaveAttribute(
          'data-status',
          'active',
        )
      } else {
        expect(indexFooUndefinedExactLink).toHaveClass('active')
        expect(indexFooUndefinedExactLink).not.toHaveClass('inactive')
        expect(indexFooUndefinedExactLink).toHaveAttribute(
          'aria-current',
          'page',
        )
        expect(indexFooUndefinedExactLink).toHaveAttribute(
          'data-status',
          'active',
        )
      }

      expect(indexFooUndefinedExactLink).toHaveAttribute('href', '/')

      expect(indexFooBarLink).toHaveClass('inactive')
      expect(indexFooBarLink).not.toHaveClass('active')
      expect(indexFooBarLink).toHaveAttribute('href', '/?foo=bar')
      expect(indexFooBarLink).not.toHaveAttribute('aria-current', 'page')
      expect(indexFooBarLink).not.toHaveAttribute('data-status', 'active')

      // navigate to /?foo=bar
      fireEvent.click(indexFooBarLink)

      await waitFor(() => {
        expect(indexFooBarLink).toHaveClass('active')
      })

      expect(indexExactLink).toHaveClass('inactive')
      expect(indexExactLink).not.toHaveClass('active')
      expect(indexExactLink).toHaveAttribute('href', '/')
      expect(indexExactLink).not.toHaveAttribute('aria-current', 'page')
      expect(indexExactLink).not.toHaveAttribute('data-status', 'active')

      if (opts.explicitUndefined) {
        expect(indexFooUndefinedLink).not.toHaveClass('active')
        expect(indexFooUndefinedLink).toHaveClass('inactive')
        expect(indexFooUndefinedLink).not.toHaveAttribute(
          'aria-current',
          'page',
        )
        expect(indexFooUndefinedLink).not.toHaveAttribute(
          'data-status',
          'active',
        )
      } else {
        expect(indexFooUndefinedLink).toHaveClass('active')
        expect(indexFooUndefinedLink).not.toHaveClass('inactive')
        expect(indexFooUndefinedLink).toHaveAttribute('aria-current', 'page')
        expect(indexFooUndefinedLink).toHaveAttribute('data-status', 'active')
      }

      expect(indexFooUndefinedLink).toHaveAttribute('href', '/')

      expect(indexFooUndefinedExactLink).toHaveClass('inactive')
      expect(indexFooUndefinedExactLink).not.toHaveClass('active')
      expect(indexFooUndefinedExactLink).toHaveAttribute('href', '/')
      expect(indexFooUndefinedExactLink).not.toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(indexFooUndefinedExactLink).not.toHaveAttribute(
        'data-status',
        'active',
      )

      expect(indexFooBarLink).toHaveClass('active')
      expect(indexFooBarLink).not.toHaveClass('inactive')
      expect(indexFooBarLink).toHaveAttribute('href', '/?foo=bar')
      expect(indexFooBarLink).toHaveAttribute('aria-current', 'page')
      expect(indexFooBarLink).toHaveAttribute('data-status', 'active')
    }

    test.each([undefined, false])(
      'activeOptions.explicitUndefined=%s',
      async (explicitUndefined) => {
        await runTest({ explicitUndefined })
      },
    )

    test('activeOptions.explicitUndefined=true', async () => {
      await runTest({ explicitUndefined: true })
    })
  })

  describe('active and href updates', () => {
    const createControlledPromise = () => {
      let resolve!: () => void
      const promise = new Promise<void>((r) => {
        resolve = r
      })

      return { promise, resolve }
    }

    test('always reports external links as inactive', async () => {
      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => (
          <Link to="https://example.com">
            {({ isActive }) => (
              <span data-testid="external-link-active">{String(isActive)}</span>
            )}
          </Link>
        ),
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute]),
        history,
      })

      render(() => <RouterProvider router={router} />)

      expect(
        await screen.findByTestId('external-link-active'),
      ).toHaveTextContent('false')
    })

    test('updates exact and fuzzy active state before the next route renders', async () => {
      const postLoader = createControlledPromise()

      const rootRoute = createRootRoute({
        component: () => (
          <>
            <Link
              data-testid="posts-exact"
              to="/posts"
              activeOptions={{ exact: true }}
              activeProps={{ class: 'active' }}
              inactiveProps={{ class: 'inactive' }}
            >
              Posts exact
            </Link>
            <Link
              data-testid="posts-fuzzy"
              to="/posts"
              activeProps={{ class: 'active' }}
              inactiveProps={{ class: 'inactive' }}
            >
              Posts fuzzy
            </Link>
            <Link
              data-testid="post-exact"
              to="/posts/$postId"
              params={{ postId: '1' }}
              activeOptions={{ exact: true }}
              activeProps={{ class: 'active' }}
              inactiveProps={{ class: 'inactive' }}
            >
              Post exact
            </Link>
            <Outlet />
          </>
        ),
      })

      const postsRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'posts',
        component: () => (
          <>
            <h1>Posts</h1>
            <Link
              data-testid="open-post"
              to="/posts/$postId"
              params={{ postId: '1' }}
            >
              Open post
            </Link>
            <Outlet />
          </>
        ),
      })

      const postRoute = createRoute({
        getParentRoute: () => postsRoute,
        path: '$postId',
        loader: () => postLoader.promise,
        component: () => <h1>Post detail</h1>,
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([postsRoute.addChildren([postRoute])]),
        history: createMemoryHistory({ initialEntries: ['/posts'] }),
        defaultPendingMs: 0,
        defaultPendingComponent: () => <p>Loading...</p>,
      })

      render(() => <RouterProvider router={router} />)

      const postsExact = await screen.findByTestId('posts-exact')
      const postsFuzzy = await screen.findByTestId('posts-fuzzy')
      const postExact = await screen.findByTestId('post-exact')

      expect(postsExact).toHaveClass('active')
      expect(postsFuzzy).toHaveClass('active')
      expect(postExact).toHaveClass('inactive')

      fireEvent.click(screen.getByTestId('open-post'))

      expect(await screen.findByText('Loading...')).toBeInTheDocument()
      expect(screen.queryByText('Post detail')).not.toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/posts/1')
      expect(postsExact).toHaveClass('inactive')
      expect(postsFuzzy).toHaveClass('active')
      expect(postExact).toHaveClass('active')

      postLoader.resolve()

      expect(await screen.findByText('Post detail')).toBeInTheDocument()
    })

    test('updates exact active state and href when only params change with params=true', async () => {
      const postLoader = createControlledPromise()
      let postLoadCount = 0

      const rootRoute = createRootRoute({
        component: () => {
          const params = useParams({ strict: false })
          const nextPostId = params().postId === '1' ? '2' : '1'

          return (
            <>
              <Link
                data-testid="current-post"
                from="/posts/$postId"
                to="."
                params={true}
                activeOptions={{ exact: true }}
                activeProps={{ class: 'active' }}
                inactiveProps={{ class: 'inactive' }}
              >
                Current post
              </Link>
              <Link
                data-testid="switch-post"
                from="/posts/$postId"
                to="."
                params={{ postId: nextPostId }}
              >
                Switch post
              </Link>
              <Outlet />
            </>
          )
        },
      })

      const postRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/posts/$postId',
        loader: () => {
          postLoadCount += 1
          return postLoadCount === 1 ? Promise.resolve() : postLoader.promise
        },
        component: () => {
          const params = useParams({ strict: false })
          return <h1>{`Post ${params().postId}`}</h1>
        },
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([postRoute]),
        history: createMemoryHistory({ initialEntries: ['/posts/1'] }),
        defaultPendingMs: 0,
        defaultPendingComponent: () => <p>Loading...</p>,
      })

      render(() => <RouterProvider router={router} />)

      const currentPost = await screen.findByTestId('current-post')
      expect(await screen.findByText('Post 1')).toBeInTheDocument()
      expect(currentPost).toHaveClass('active')
      expect(currentPost).toHaveAttribute('href', '/posts/1')

      fireEvent.click(screen.getByTestId('switch-post'))

      expect(await screen.findByText('Loading...')).toBeInTheDocument()
      expect(screen.queryByText('Post 2')).not.toBeInTheDocument()
      expect(router.state.location.pathname).toBe('/posts/2')
      expect(currentPost).toHaveClass('active')

      await waitFor(() => {
        expect(currentPost).toHaveAttribute('href', '/posts/2')
      })

      postLoader.resolve()

      expect(await screen.findByText('Post 2')).toBeInTheDocument()
    })

    test('updates search-sensitive active state immediately with and without search=true', async () => {
      const postsLoader = createControlledPromise()
      let postsLoadCount = 0

      const rootRoute = createRootRoute({
        component: () => {
          const search = useSearch({ strict: false })
          const nextPage = Number(search().page ?? 1) === 1 ? 2 : 1

          return (
            <>
              <Link
                data-testid="static-search"
                to="/posts"
                search={{ page: 1 }}
                activeOptions={{ exact: true, includeSearch: true }}
                activeProps={{ class: 'active' }}
                inactiveProps={{ class: 'inactive' }}
              >
                Static search
              </Link>
              <Link
                data-testid="current-search"
                to="/posts"
                search={true}
                activeOptions={{ exact: true, includeSearch: true }}
                activeProps={{ class: 'active' }}
                inactiveProps={{ class: 'inactive' }}
              >
                Current search
              </Link>
              <Link
                data-testid="switch-search"
                from="/posts"
                to="."
                search={{ page: nextPage }}
              >
                Switch search
              </Link>
              <Outlet />
            </>
          )
        },
      })

      const postsRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/posts',
        validateSearch: (input: Record<string, unknown>) => ({
          page: Number(input.page ?? 1),
        }),
        loaderDeps: ({ search }) => ({ page: search.page }),
        loader: () => {
          postsLoadCount += 1
          return postsLoadCount === 1 ? Promise.resolve() : postsLoader.promise
        },
        component: () => {
          const search = useSearch({ strict: false })
          return <h1>{`Posts ${search().page}`}</h1>
        },
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([postsRoute]),
        history: createMemoryHistory({ initialEntries: ['/posts?page=1'] }),
        defaultPendingMs: 0,
        defaultPendingComponent: () => <p>Loading...</p>,
      })

      render(() => <RouterProvider router={router} />)

      const staticSearch = await screen.findByTestId('static-search')
      const currentSearch = await screen.findByTestId('current-search')

      expect(await screen.findByText('Posts 1')).toBeInTheDocument()
      expect(staticSearch).toHaveClass('active')
      expect(currentSearch).toHaveClass('active')
      expect(currentSearch).toHaveAttribute('href', '/posts?page=1')

      fireEvent.click(screen.getByTestId('switch-search'))

      expect(await screen.findByText('Loading...')).toBeInTheDocument()
      expect(screen.queryByText('Posts 2')).not.toBeInTheDocument()
      expect(router.state.location.search).toEqual({ page: 2 })
      expect(staticSearch).toHaveClass('inactive')
      expect(currentSearch).toHaveClass('active')

      await waitFor(() => {
        expect(currentSearch).toHaveAttribute('href', '/posts?page=2')
      })

      postsLoader.resolve()

      expect(await screen.findByText('Posts 2')).toBeInTheDocument()
    })

    test('updates hash-sensitive active state immediately with and without hash=true', async () => {
      const rootRoute = createRootRoute({
        component: () => (
          <>
            <Link
              data-testid="static-hash"
              to="/posts"
              hash="first"
              activeOptions={{ exact: true, includeHash: true }}
              activeProps={{ class: 'active' }}
              inactiveProps={{ class: 'inactive' }}
            >
              Static hash
            </Link>
            <Link
              data-testid="current-hash"
              to="/posts"
              hash={true}
              activeOptions={{ exact: true, includeHash: true }}
              activeProps={{ class: 'active' }}
              inactiveProps={{ class: 'inactive' }}
            >
              Current hash
            </Link>
            <Link data-testid="switch-hash" from="/posts" to="." hash="second">
              Switch hash
            </Link>
            <Outlet />
          </>
        ),
      })

      const postsRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/posts',
        component: () => <h1>Posts</h1>,
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([postsRoute]),
        history: createMemoryHistory({ initialEntries: ['/posts#first'] }),
      })

      render(() => <RouterProvider router={router} />)

      const staticHash = await screen.findByTestId('static-hash')
      const currentHash = await screen.findByTestId('current-hash')

      expect(staticHash).toHaveClass('active')
      expect(currentHash).toHaveClass('active')
      expect(currentHash).toHaveAttribute('href', '/posts#first')

      await fireEvent.click(screen.getByTestId('switch-hash'))

      expect(router.state.location.hash).toBe('second')
      expect(staticHash).toHaveClass('inactive')
      expect(currentHash).toHaveClass('active')

      await waitFor(() => {
        expect(currentHash).toHaveAttribute('href', '/posts#second')
      })
    })

    test('eventually updates relative hrefs when the current route changes', async () => {
      const rootRoute = createRootRoute({
        component: () => (
          <>
            <Link data-testid="relative-foo" to="./foo">
              Relative foo
            </Link>
            <Link data-testid="to-posts" to="/posts">
              To posts
            </Link>
            <Link data-testid="to-invoices" to="/invoices">
              To invoices
            </Link>
            <Outlet />
          </>
        ),
      })

      const postsRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/posts',
        component: () => <h1>Posts</h1>,
      })

      const postsFooRoute = createRoute({
        getParentRoute: () => postsRoute,
        path: 'foo',
        component: () => <h1>Posts foo</h1>,
      })

      const invoicesRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/invoices',
        component: () => <h1>Invoices</h1>,
      })

      const invoicesFooRoute = createRoute({
        getParentRoute: () => invoicesRoute,
        path: 'foo',
        component: () => <h1>Invoices foo</h1>,
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([
          postsRoute.addChildren([postsFooRoute]),
          invoicesRoute.addChildren([invoicesFooRoute]),
        ]),
        history: createMemoryHistory({ initialEntries: ['/posts'] }),
      })

      render(() => <RouterProvider router={router} />)

      const relativeFoo = await screen.findByTestId('relative-foo')
      expect(await screen.findByText('Posts')).toBeInTheDocument()
      expect(relativeFoo).toHaveAttribute('href', '/posts/foo')

      fireEvent.click(screen.getByTestId('to-invoices'))

      expect(await screen.findByText('Invoices')).toBeInTheDocument()

      await waitFor(() => {
        expect(relativeFoo).toHaveAttribute('href', '/invoices/foo')
      })
    })
  })

  test('when the current route is the root with beforeLoad that throws', async () => {
    const onError = vi.fn()
    const rootRoute = createRootRoute({
      onError,
      beforeLoad: () => {
        throw new Error('Something went wrong!')
      },
      errorComponent: () => <span>Oops! Something went wrong!</span>,
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/" activeProps={{ class: 'active' }}>
              Index
            </Link>
            <Link to="/posts" inactiveProps={{ class: 'inactive' }}>
              Posts
            </Link>
          </>
        )
      },
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => {
        return <h1>Posts</h1>
      },
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const errorText = await screen.findByText('Oops! Something went wrong!')
    expect(errorText).toBeInTheDocument()
    expect(onError).toHaveBeenCalledOnce()
  })

  test('when navigating to /posts', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/">Index</Link>
            <Link to="/posts">Posts</Link>
          </>
        )
      },
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => {
        return (
          <>
            <h1>Posts</h1>
            <Link to="/">Index</Link>
            <Link to="/posts" activeProps={{ class: 'active' }}>
              Posts
            </Link>
          </>
        )
      },
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    fireEvent.click(postsLink)

    const postsHeading = await screen.findByRole('heading', { name: 'Posts' })
    expect(postsHeading).toBeInTheDocument()

    expect(window.location.pathname).toBe('/posts')

    const indexLink = await screen.findByRole('link', { name: 'Index' })

    expect(window.location.pathname).toBe('/posts')
    expect(indexLink).not.toHaveAttribute('aria-current', 'page')
    expect(indexLink).not.toHaveAttribute('data-status', 'active')
    expect(indexLink).toHaveAttribute('href', '/')

    expect(postsLink).toHaveAttribute('data-status', 'active')
    expect(postsLink).toHaveAttribute('aria-current', 'page')
    expect(postsLink).toHaveClass('active')
    expect(postsLink).toHaveAttribute('href', '/posts')
  })

  test('when navigating to /posts with a base url', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/">Index</Link>
            <Link to="/posts">Posts</Link>
          </>
        )
      },
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => {
        return (
          <>
            <h1>Posts</h1>
            <Link to="/">Index</Link>
            <Link to="/posts" activeProps={{ class: 'active' }}>
              Posts
            </Link>
          </>
        )
      },
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
      basepath: '/app',
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    fireEvent.click(postsLink)

    const postsHeading = await screen.findByRole('heading', { name: 'Posts' })
    expect(postsHeading).toBeInTheDocument()

    const indexLink = await screen.findByRole('link', { name: 'Index' })

    expect(window.location.pathname).toBe('/app/posts')
    expect(indexLink).not.toHaveAttribute('aria-current', 'page')
    expect(indexLink).not.toHaveAttribute('data-status', 'active')
    expect(indexLink).toHaveAttribute('href', '/app/')

    expect(postsLink).toHaveAttribute('data-status', 'active')
    expect(postsLink).toHaveAttribute('aria-current', 'page')
    expect(postsLink).toHaveClass('active')
    expect(postsLink).toHaveAttribute('href', '/app/posts')
  })

  test('when navigating to /posts with search', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts" search={{ page: 0 }}>
              Posts
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      const search = useSearch({ strict: false })
      return (
        <>
          <h1>Posts</h1>
          <span>Page: {search().page}</span>
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      validateSearch: (input: Record<string, unknown>) => {
        return {
          page: input.page,
        }
      },
      component: PostsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    expect(postsLink).toHaveAttribute('href', '/posts?page=0')

    fireEvent.click(postsLink)

    const postsHeading = await screen.findByRole('heading', { name: 'Posts' })
    expect(postsHeading).toBeInTheDocument()

    expect(window.location.pathname).toBe('/posts')
    expect(window.location.search).toBe('?page=0')

    const pageZero = await screen.findByText('Page: 0')
    expect(pageZero).toBeInTheDocument()
  })

  test('when navigation to . from /posts while updating search from /', async () => {
    const RootComponent = () => {
      return (
        <>
          <div data-testid="root-nav">
            <Link
              to="."
              search={{ page: 2, filter: 'inactive' }}
              data-testid="update-search"
            >
              Update Search
            </Link>
          </div>
          <Outlet />
        </>
      )
    }

    const rootRoute = createRootRoute({
      component: RootComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link
              to="/posts"
              search={{ page: 1, filter: 'active' }}
              data-testid="to-posts"
            >
              Go to Posts
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      const search = useSearch({ strict: false })
      return (
        <>
          <h1>Posts</h1>
          <span data-testid="current-page">Page: {search().page}</span>
          <span data-testid="current-filter">Filter: {search().filter}</span>
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      validateSearch: (input: Record<string, unknown>) => {
        return {
          page: input.page ? Number(input.page) : 1,
          filter: (input.filter as string) || 'all',
        }
      },
      component: PostsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
      history,
    })

    render(() => <RouterProvider router={router} />)

    // Start at index page
    const toPostsLink = await screen.findByTestId('to-posts')
    expect(toPostsLink).toHaveAttribute('href', '/posts?page=1&filter=active')

    // Navigate to posts with initial search params
    fireEvent.click(toPostsLink)

    // Verify we're on posts with initial search
    const postsHeading = await screen.findByRole('heading', { name: 'Posts' })
    expect(postsHeading).toBeInTheDocument()
    expect(window.location.pathname).toBe('/posts')
    expect(window.location.search).toBe('?page=1&filter=active')

    const currentPage = await screen.findByTestId('current-page')
    const currentFilter = await screen.findByTestId('current-filter')
    expect(currentPage).toHaveTextContent('Page: 1')
    expect(currentFilter).toHaveTextContent('Filter: active')

    // Navigate to current route (.) with updated search
    const updateSearchLink = await screen.findByTestId('update-search')
    expect(updateSearchLink).toHaveAttribute(
      'href',
      '/posts?page=2&filter=inactive',
    )

    fireEvent.click(updateSearchLink)

    // Wait for navigation to complete and search params to update
    await waitFor(() => {
      expect(window.location.search).toBe('?page=2&filter=inactive')
    })

    const updatedPage = await screen.findByTestId('current-page')
    const updatedFilter = await screen.findByTestId('current-filter')

    // Verify search was updated
    // Wait for navigation to complete and search params to update
    await waitFor(() => {
      expect(window.location.pathname).toBe('/posts')
      expect(window.location.search).toBe('?page=2&filter=inactive')
    })

    expect(updatedPage).toHaveTextContent('Page: 2')
    expect(updatedFilter).toHaveTextContent('Filter: inactive')
  })

  test('when navigation to . from /posts while updating search from / and using base path', async () => {
    const RootComponent = () => {
      return (
        <>
          <div data-testid="root-nav">
            <Link
              to="."
              search={{ page: 2, filter: 'inactive' }}
              data-testid="update-search"
            >
              Update Search
            </Link>
          </div>
          <Outlet />
        </>
      )
    }

    const rootRoute = createRootRoute({
      component: RootComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link
              to="/posts"
              search={{ page: 1, filter: 'active' }}
              data-testid="to-posts"
            >
              Go to Posts
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      const search = useSearch({ strict: false })
      return (
        <>
          <h1>Posts</h1>
          <span data-testid="current-page">Page: {search().page}</span>
          <span data-testid="current-filter">Filter: {search().filter}</span>
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      validateSearch: (input: Record<string, unknown>) => {
        return {
          page: input.page ? Number(input.page) : 1,
          filter: (input.filter as string) || 'all',
        }
      },
      component: PostsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
      history,
    })

    render(() => <RouterProvider router={router} basepath={'/Dashboard'} />)

    // Start at index page
    const toPostsLink = await screen.findByTestId('to-posts')
    expect(toPostsLink).toHaveAttribute(
      'href',
      '/Dashboard/posts?page=1&filter=active',
    )

    // Navigate to posts with initial search params
    fireEvent.click(toPostsLink)

    // Verify we're on posts with initial search
    const postsHeading = await screen.findByRole('heading', { name: 'Posts' })
    expect(postsHeading).toBeInTheDocument()
    expect(window.location.pathname).toBe('/Dashboard/posts')
    expect(window.location.search).toBe('?page=1&filter=active')

    const currentPage = await screen.findByTestId('current-page')
    const currentFilter = await screen.findByTestId('current-filter')
    expect(currentPage).toHaveTextContent('Page: 1')
    expect(currentFilter).toHaveTextContent('Filter: active')

    // Navigate to current route (.) with updated search
    const updateSearchLink = await screen.findByTestId('update-search')

    expect(updateSearchLink).toHaveAttribute(
      'href',
      '/Dashboard/posts?page=2&filter=inactive',
    )

    await fireEvent.click(updateSearchLink)

    // Wait for navigation to complete and search params to update
    await waitFor(() => {
      expect(window.location.search).toBe('?page=2&filter=inactive')
    })

    await screen.findByTestId('current-page')
    // Verify search was updated
    expect(window.location.pathname).toBe('/Dashboard/posts')
    expect(window.location.search).toBe('?page=2&filter=inactive')

    const updatedPage = await screen.findByTestId('current-page')
    const updatedFilter = await screen.findByTestId('current-filter')
    expect(updatedPage).toHaveTextContent('Page: 2')
    expect(updatedFilter).toHaveTextContent('Filter: inactive')
  })

  test('when navigating to /posts with invalid search', async () => {
    const rootRoute = createRootRoute()
    const onError = vi.fn()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts" search={{ page: 'invalid' }}>
              Posts
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      const search = useSearch({ strict: false })
      return (
        <>
          <h1>Posts</h1>
          <span>Page: {search().page}</span>
        </>
      )
    }

    const ErrorComponent = () => {
      return <h1>Oops, something went wrong</h1>
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      errorComponent: ErrorComponent,
      onError,
      validateSearch: (input: Record<string, unknown>) => {
        const page = Number(input.page)

        if (isNaN(page)) throw Error('Not a number!')

        return {
          page,
        }
      },
      component: PostsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    expect(postsLink).toHaveAttribute('href', '/posts?page=invalid')

    fireEvent.click(postsLink)

    await waitFor(() => expect(onError).toHaveBeenCalledOnce())

    const errorHeading = await screen.findByRole('heading', {
      name: 'Oops, something went wrong',
    })
    expect(errorHeading).toBeInTheDocument()
  })

  test('when navigating to /posts with a loader', async () => {
    const loader = vi.fn((opts) => {
      return Promise.resolve({ pageDoubled: opts.deps.page.page * 2 })
    })
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts" search={{ page: 2 }}>
              Posts
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      const data = useLoaderData({ strict: false })
      return (
        <>
          <h1>Posts</h1>
          <span>Page: {data().pageDoubled}</span>
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      validateSearch: (input: Record<string, unknown>) => {
        const page = Number(input.page)

        if (isNaN(page)) throw Error('Not a number!')

        return {
          page,
        }
      },
      loaderDeps: (opts) => ({ page: opts.search }),
      loader: loader,
      component: PostsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    expect(postsLink).toHaveAttribute('href', '/posts?page=2')

    fireEvent.click(postsLink)

    const pageFour = await screen.findByText('Page: 4')
    expect(pageFour).toBeInTheDocument()

    expect(loader).toHaveBeenCalledOnce()
  })

  test('when navigating to /posts with a loader that errors', async () => {
    const onError = vi.fn()
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts" search={{ page: 2 }}>
              Posts
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      const loader = useLoaderData({ strict: false })
      return (
        <>
          <h1>Posts</h1>
          <span>Page: {loader().pageDoubled}</span>
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      validateSearch: (input: Record<string, unknown>) => {
        const page = Number(input.page)

        if (isNaN(page)) throw Error('Not a number!')

        return {
          page,
        }
      },
      loaderDeps: (opts) => ({ page: opts.search }),
      onError,
      errorComponent: () => <span>Something went wrong!</span>,
      loader: () => {
        throw new Error()
      },
      component: PostsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    expect(postsLink).toHaveAttribute('href', '/posts?page=2')

    fireEvent.click(postsLink)

    const errorText = await screen.findByText('Something went wrong!')
    expect(errorText).toBeInTheDocument()

    expect(onError).toHaveBeenCalledOnce()
  })

  test('when navigating away from a route with a loader that errors', async () => {
    const postsOnError = vi.fn()
    const indexOnError = vi.fn()
    const rootRoute = createRootRoute({
      component: () => (
        <>
          <div>
            <Link to="/">Index</Link> <Link to="/posts">Posts</Link>
          </div>
          <hr />
          <Outlet />
        </>
      ),
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
          </>
        )
      },
      onError: indexOnError,
      errorComponent: () => <span>IndexError</span>,
    })

    const error = new Error('Something went wrong!')

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      loaderDeps: (opts) => ({ page: opts.search }),
      loader: () => {
        throw error
      },
      onError: postsOnError,
      errorComponent: () => <span>PostsError</span>,
      component: () => {
        return (
          <>
            <h1>Posts</h1>
          </>
        )
      },
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    fireEvent.click(postsLink)

    await sleep(WAIT_TIME)

    const postsErrorText = await screen.findByText('PostsError')
    expect(postsErrorText).toBeInTheDocument()

    expect(postsOnError).toHaveBeenCalledOnce()
    expect(postsOnError).toHaveBeenCalledWith(error)

    const indexLink = await screen.findByRole('link', { name: 'Index' })
    fireEvent.click(indexLink)
    await sleep(WAIT_TIME)
    await expect(screen.findByText('IndexError')).rejects.toThrow()
    expect(indexOnError).not.toHaveBeenCalledOnce()
  })

  test('when navigating to /posts with a beforeLoad that redirects', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts" search={{ page: 2 }}>
              Posts
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return <h1>Posts</h1>
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      beforeLoad: () => {
        throw redirect({
          to: '/login',
        })
      },
      component: PostsComponent,
    })

    const authRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'login',
      component: () => <h1>Auth!</h1>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute, authRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    fireEvent.click(postsLink)

    const authText = await screen.findByText('Auth!')
    expect(authText).toBeInTheDocument()
  })

  test('when navigating to /posts with a beforeLoad that returns context', async () => {
    const rootRoute = createRootRouteWithContext<{
      userId: string
    }>()()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      const context = useRouteContext({ strict: false })
      return (
        <>
          <h1>Posts</h1>
          <span>UserId: {context().userId}</span>
          <span>Username: {context().username}</span>
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      beforeLoad: () => {
        return Promise.resolve({
          username: 'username',
        })
      },
      component: PostsComponent,
    })

    const router = createRouter({
      context: { userId: 'userId' },
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    fireEvent.click(postsLink)

    const userId = await screen.findByText('UserId: userId')
    expect(userId).toBeInTheDocument()
  })

  test('when navigating to /posts with a beforeLoad that throws an error', async () => {
    const onError = vi.fn()
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return <h1>Posts</h1>
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      beforeLoad: () => {
        throw new Error('Oops. Something went wrong!')
      },
      onError,
      errorComponent: () => <span>Oops! Something went wrong!</span>,
      component: PostsComponent,
    })

    const router = createRouter({
      context: { userId: 'userId' },
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    fireEvent.click(postsLink)

    const errorText = await screen.findByText('Oops! Something went wrong!')
    expect(errorText).toBeInTheDocument()

    expect(onError).toHaveBeenCalledOnce()
  })

  test('when navigating to /posts with a beforeLoad that throws an error bubbles to the root', async () => {
    const rootRoute = createRootRoute({
      errorComponent: () => <span>Oops! Something went wrong!</span>,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return <h1>Posts</h1>
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      beforeLoad: () => {
        throw new Error('Oops. Something went wrong!')
      },
      component: PostsComponent,
    })

    const router = createRouter({
      context: { userId: 'userId' },
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    fireEvent.click(postsLink)

    const errorText = await screen.findByText('Oops! Something went wrong!')
    expect(errorText).toBeInTheDocument()
  })

  test('when navigating to /posts with a beforeLoad that throws an error bubbles to the nearest parent', async () => {
    const rootRoute = createRootRoute({
      errorComponent: () => <span>Root error</span>,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts/$postId" params={{ postId: 'id1' }}>
              Post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      errorComponent: () => <span>Oops! Something went wrong!</span>,
      component: PostsComponent,
    })

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      beforeLoad: () => {
        throw new Error('Oops. Something went wrong!')
      },
    })

    const router = createRouter({
      context: { userId: 'userId' },
      routeTree: rootRoute.addChildren([
        indexRoute,
        postsRoute.addChildren([postRoute]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postLink = await screen.findByRole('link', { name: 'Post' })

    fireEvent.click(postLink)

    const errorText = await screen.findByText('Oops! Something went wrong!')
    expect(errorText).toBeInTheDocument()
  })

  test('when navigating to the root with an error in component', async () => {
    const notFoundComponent = vi.fn()

    const rootRoute = createRootRoute({
      errorComponent: () => <span>Expected rendering error message</span>,
      notFoundComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        throw new Error(
          'Error from component should not render notFoundComponent',
        )
      },
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const errorText = await screen.findByText(
      'Expected rendering error message',
    )
    expect(errorText).toBeInTheDocument()
    expect(notFoundComponent).not.toBeCalled()
  })

  test('when navigating to /posts with params', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link
              to="/posts/$postId"
              params={{ postId: 'id1' }}
              preloadDelay={0}
            >
              To first post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Link to="/">Index</Link>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return <span>Params: {params().postId}</span>
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        postsRoute.addChildren([postRoute]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postLink = await screen.findByRole('link', {
      name: 'To first post',
    })

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.click(postLink)

    const paramText = await screen.findByText('Params: id1')
    expect(paramText).toBeInTheDocument()
  })

  test('keeps a relative link active when changing inherited params (issue #5655)', async () => {
    const rootRoute = createRootRoute()

    const postRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/post/$postId',
      component: () => {
        const params = useParams({ strict: false })
        const postId = () => params().postId

        return (
          <>
            <Link
              data-testid="step1-link"
              from="/post/$postId"
              to="step1"
              activeProps={{ class: 'active' }}
            >
              Step 1
            </Link>
            <Link
              data-testid="step2-link"
              from="/post/$postId"
              to="step2"
              params={{ postId: postId() }}
              activeProps={{ class: 'active' }}
            >
              Step 2
            </Link>
            <Outlet />
          </>
        )
      },
    })

    const step1Route = createRoute({
      getParentRoute: () => postRoute,
      path: 'step1',
      component: () => {
        const params = useParams({ strict: false })
        const postId = () => params().postId
        const otherPostId = () => (postId() === '1' ? '2' : '1')

        return (
          <>
            <span>{`Post ${postId()} step1`}</span>
            <Link
              data-testid="switch-post-link"
              from="/post/$postId/step1"
              to="."
              params={{ postId: otherPostId() }}
            >{`Go to post ${otherPostId()}`}</Link>
          </>
        )
      },
    })

    const step2Route = createRoute({
      getParentRoute: () => postRoute,
      path: 'step2',
      component: () => {
        const params = useParams({ strict: false })
        const postId = () => params().postId
        const otherPostId = () => (postId() === '1' ? '2' : '1')

        return (
          <>
            <span>{`Post ${postId()} step2`}</span>
            <Link
              data-testid="switch-post-link"
              from="/post/$postId/step2"
              to="."
              params={{ postId: otherPostId() }}
            >{`Go to post ${otherPostId()}`}</Link>
          </>
        )
      },
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        postRoute.addChildren([step1Route, step2Route]),
      ]),
      history: createMemoryHistory({
        initialEntries: ['/post/1/step1'],
      }),
    })

    render(() => <RouterProvider router={router} />)

    expect(await screen.findByText('Post 1 step1')).toBeInTheDocument()
    expect(screen.getByTestId('step1-link')).toHaveClass('active')

    fireEvent.click(screen.getByTestId('switch-post-link'))

    expect(await screen.findByText('Post 2 step1')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/post/2/step1')
    expect(screen.getByTestId('step1-link')).toHaveClass('active')

    fireEvent.click(screen.getByTestId('step2-link'))

    expect(await screen.findByText('Post 2 step2')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/post/2/step2')
    expect(screen.getByTestId('step2-link')).toHaveClass('active')

    fireEvent.click(screen.getByTestId('switch-post-link'))

    expect(await screen.findByText('Post 1 step2')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/post/1/step2')
    expect(screen.getByTestId('step2-link')).toHaveClass('active')
  })

  test('when navigating from /posts to ./$postId', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
            <Link to="/posts/$postId" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostsIndexComponent = () => {
      return (
        <>
          <h1>Posts Index</h1>
          <Link from="/posts/" to="./$postId" params={{ postId: 'id1' }}>
            To the first post
          </Link>
        </>
      )
    }

    const postsIndexRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '/',
      component: PostsIndexComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Link to="/">Index</Link>
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        postsRoute.addChildren([postsIndexRoute, postRoute]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    expect(postsLink).toHaveAttribute('href', '/posts')

    fireEvent.click(postsLink)

    const postsText = await screen.findByText('Posts Index')
    expect(postsText).toBeInTheDocument()

    const postLink = await screen.findByRole('link', {
      name: 'To the first post',
    })

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.click(postLink)

    const paramText = await screen.findByText('Params: id1')
    expect(paramText).toBeInTheDocument()

    expect(window.location.pathname).toBe('/posts/id1')
  })

  test('when navigating from /posts/$postId to "/"', async () => {
    const rootRoute = createRootRoute({
      component: () => {
        return (
          <>
            <Link to="/" data-testid="home-link">
              Home
            </Link>
            <Link to="/posts" data-testid="posts-link">
              Posts
            </Link>
            <Outlet />
          </>
        )
      },
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1 data-testid="home-heading">Index</h1>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Link
            to="/posts/$postId"
            params={{ postId: 'id1' }}
            data-testid="post1-link"
          >
            To first post
          </Link>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostsIndexComponent = () => {
      return (
        <>
          <h1 data-testid="posts-index-heading">Posts Index</h1>
          <Outlet />
        </>
      )
    }

    const postsIndexRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '/',
      component: PostsIndexComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span data-testid="post-param">Params: {params().postId}</span>
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        postsRoute.addChildren([postsIndexRoute, postRoute]),
      ]),
      history,
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByTestId('posts-link')

    expect(postsLink).toHaveAttribute('href', '/posts')

    fireEvent.click(postsLink)

    const postsText = await screen.findByTestId('posts-index-heading')
    expect(postsText).toBeInTheDocument()

    const postLink = await screen.findByTestId('post1-link')

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.click(postLink)

    const paramText = await screen.findByTestId('post-param')
    expect(paramText).toBeInTheDocument()

    expect(window.location.pathname).toBe('/posts/id1')

    const homeLink = await screen.findByTestId('home-link')

    const consoleWarnSpy = vi.spyOn(console, 'warn')

    fireEvent.click(homeLink)

    const homeHeading = await screen.findByTestId('home-heading')

    expect(window.location.pathname).toBe('/')
    expect(homeHeading).toBeInTheDocument()

    expect(consoleWarnSpy).not.toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  test('when navigating from /posts to ../posts/$postId', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
            <Link to="/posts/$postId" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostsIndexComponent = () => {
      return (
        <>
          <h1>Posts Index</h1>
          <Link from="/posts/" to="../posts/$postId" params={{ postId: 'id1' }}>
            To the first post
          </Link>
        </>
      )
    }

    const postsIndexRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '/',
      component: PostsIndexComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Link to="/">Index</Link>
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        postsRoute.addChildren([postsIndexRoute, postRoute]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })

    expect(postsLink).toHaveAttribute('href', '/posts')

    fireEvent.click(postsLink)

    const postsIndexText = await screen.findByText('Posts Index')
    expect(postsIndexText).toBeInTheDocument()

    const postLink = await screen.findByRole('link', {
      name: 'To the first post',
    })

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.click(postLink)

    const paramText = await screen.findByText('Params: id1')
    expect(paramText).toBeInTheDocument()
  })

  test('when navigating from /posts/$postId to /posts/$postId/info and the current route is /posts/$postId/details', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
            <Link to="/posts/$postId/details" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const DetailsComponent = () => {
      return (
        <>
          <h1>Details!</h1>
          <Link from="/posts/$postId" to="/posts/$postId/info">
            To Information
          </Link>
        </>
      )
    }

    const detailsRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'details',
      component: DetailsComponent,
    })

    const InformationComponent = () => {
      return <h1>Information</h1>
    }

    const informationRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'info',
      component: InformationComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          postsRoute.addChildren([
            postRoute.addChildren([detailsRoute, informationRoute]),
          ]),
        ]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'To first post' })

    expect(postsLink).toHaveAttribute('href', '/posts/id1/details')

    fireEvent.click(postsLink)

    const paramsText1 = await screen.findByText('Params: id1')
    expect(paramsText1).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/details')

    const informationLink = await screen.findByRole('link', {
      name: 'To Information',
    })

    expect(informationLink).toHaveAttribute('href', '/posts/id1/info')

    fireEvent.click(informationLink)

    const informationText = await screen.findByText('Information')
    expect(informationText).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/info')

    const paramsText2 = await screen.findByText('Params: id1')
    expect(paramsText2).toBeInTheDocument()

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating from /posts/$postId with a trailing slash to /posts/$postId/info and the current route is /posts/$postId/details', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
            <Link to="/posts/$postId/details" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const postIndexRoute = createRoute({
      getParentRoute: () => postRoute,
      path: '/',
      component: () => <div>Post Index</div>,
    })

    const DetailsComponent = () => {
      return (
        <>
          <h1>Details!</h1>
          <Link from="/posts/$postId" to="/posts/$postId/info">
            To Information
          </Link>
        </>
      )
    }

    const detailsRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'details',
      component: DetailsComponent,
    })

    const InformationComponent = () => {
      return <h1>Information</h1>
    }

    const informationRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'info',
      component: InformationComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          postsRoute.addChildren([
            postRoute.addChildren([
              postIndexRoute,
              detailsRoute,
              informationRoute,
            ]),
          ]),
        ]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'To first post' })

    expect(postsLink).toHaveAttribute('href', '/posts/id1/details')

    fireEvent.click(postsLink)

    const paramsText1 = await screen.findByText('Params: id1')
    expect(paramsText1).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/details')

    const informationLink = await screen.findByRole('link', {
      name: 'To Information',
    })

    expect(informationLink).toHaveAttribute('href', '/posts/id1/info')

    fireEvent.click(informationLink)

    const informationText = await screen.findByText('Information')
    expect(informationText).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/info')

    const paramsText2 = await screen.findByText('Params: id1')
    expect(paramsText2).toBeInTheDocument()

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating from /dashboard/posts/$postId to /dashboard/users', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/dashboard" data-testid="dashboard-link">
              dashboard
            </Link>
          </>
        )
      },
    })

    const dashboardRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'dashboard',
      component: () => {
        return (
          <>
            <h1 data-testid="dashboard-heading">dashboard</h1>
            <Link to="/dashboard/posts" data-testid="posts-link">
              posts
            </Link>
            <Link to="/dashboard/users" data-testid="users-link">
              users
            </Link>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1 data-testid="posts-heading">Posts</h1>
          <Link
            to="/dashboard/posts/$postid"
            data-testid="post1-link"
            params={{ postid: 'id1' }}
          >
            Post1
          </Link>
          <Link
            to="/dashboard/posts/$postid"
            data-testid="post2-link"
            params={{ postid: 'id2' }}
          >
            Post2
          </Link>
          <Outlet />
        </>
      )
    }

    const UsersComponent = () => {
      return (
        <>
          <h1 data-testid="users-heading">Users</h1>
          <Link
            to="/dashboard/users/$userid"
            data-testid="user1-link"
            params={{ userid: 'id1' }}
          >
            User1
          </Link>
          <Link
            to="/dashboard/users/$userid"
            data-testid="user2-link"
            params={{ userid: 'id2' }}
          >
            User2
          </Link>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => dashboardRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const usersRoute = createRoute({
      getParentRoute: () => dashboardRoute,
      path: 'users',
      component: UsersComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span data-testid="post-component">Params: {params().postId}</span>
        </>
      )
    }

    const UserComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span data-testid="user-component">Params: {params().userId}</span>
        </>
      )
    }
    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postid',
      component: PostComponent,
    })

    const userRoute = createRoute({
      getParentRoute: () => usersRoute,
      path: '$userid',
      component: UserComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        dashboardRoute.addChildren([
          postsRoute.addChildren([postRoute]),
          usersRoute.addChildren([userRoute]),
        ]),
      ]),
      history,
    })

    render(() => <RouterProvider router={router} />)

    const dashboardLink = await screen.findByTestId('dashboard-link')

    fireEvent.click(dashboardLink)

    const dashboardHeading = await screen.findByTestId('dashboard-heading')

    expect(dashboardHeading).toBeInTheDocument()

    const postsLink = await screen.findByTestId('posts-link')
    fireEvent.click(postsLink)

    const postsHeading = await screen.findByTestId('posts-heading')

    expect(window.location.pathname).toEqual('/dashboard/posts')
    expect(postsHeading).toBeInTheDocument()

    const post1Link = await screen.findByTestId('post1-link')
    fireEvent.click(post1Link)
    const post1Heading = await screen.findByTestId('post-component')

    expect(window.location.pathname).toEqual('/dashboard/posts/id1')
    expect(post1Heading).toBeInTheDocument()

    const consoleWarnSpy = vi.spyOn(console, 'warn')

    const usersLink = await screen.findByTestId('users-link')
    fireEvent.click(usersLink)

    const usersHeading = await screen.findByTestId('users-heading')

    expect(window.location.pathname).toEqual('/dashboard/users')
    expect(usersHeading).toBeInTheDocument()

    const user1Link = await screen.findByTestId('user1-link')
    fireEvent.click(user1Link)
    const user1Heading = await screen.findByTestId('user-component')

    expect(window.location.pathname).toEqual('/dashboard/users/id1')
    expect(user1Heading).toBeInTheDocument()

    expect(consoleWarnSpy).not.toHaveBeenCalled()

    consoleWarnSpy.mockRestore()
  })

  test('when navigating from /posts/$postId to ./info and the current route is /posts/$postId/details', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
            <Link to="/posts/$postId/details" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const DetailsComponent = () => {
      return (
        <>
          <h1>Details!</h1>
          <Link from="/posts/$postId" to="./info">
            To Information
          </Link>
        </>
      )
    }

    const detailsRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'details',
      component: DetailsComponent,
    })

    const InformationComponent = () => {
      return <h1>Information</h1>
    }

    const informationRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'info',
      component: InformationComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          postsRoute.addChildren([
            postRoute.addChildren([detailsRoute, informationRoute]),
          ]),
        ]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'To first post' })

    expect(postsLink).toHaveAttribute('href', '/posts/id1/details')

    fireEvent.click(postsLink)

    const paramsText1 = await screen.findByText('Params: id1')
    expect(paramsText1).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/details')

    const informationLink = await screen.findByRole('link', {
      name: 'To Information',
    })

    expect(informationLink).toHaveAttribute('href', '/posts/id1/info')

    fireEvent.click(informationLink)

    const informationText = await screen.findByText('Information')
    expect(informationText).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/info')

    const paramsText2 = await screen.findByText('Params: id1')
    expect(paramsText2).toBeInTheDocument()

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating from /posts/$postId to / and the current route is /posts/$postId/details', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
            <Link to="/posts/$postId/details" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const DetailsComponent = () => {
      return (
        <>
          <h1>Details!</h1>
          <Link from="/posts/$postId" to="/">
            To Root
          </Link>
        </>
      )
    }

    const detailsRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'details',
      component: DetailsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          postsRoute.addChildren([postRoute.addChildren([detailsRoute])]),
        ]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'To first post' })

    expect(postsLink).toHaveAttribute('href', '/posts/id1/details')

    fireEvent.click(postsLink)

    const paramsText1 = await screen.findByText('Params: id1')
    expect(paramsText1).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/details')

    const rootLink = await screen.findByRole('link', {
      name: 'To Root',
    })

    expect(rootLink).toHaveAttribute('href', '/')

    fireEvent.click(rootLink)

    const indexText = await screen.findByText('Index')
    expect(indexText).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/')

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating from /posts/$postId with search and to ./info with search and the current route is /posts/$postId/details', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
            <Link
              to="/posts/$postId/details"
              params={{ postId: 'id1' }}
              search={{ page: 2 }}
            >
              To first post
            </Link>
          </>
        )
      },
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
      validateSearch: () => ({ page: 2 }),
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const DetailsComponent = () => {
      return (
        <>
          <h1>Details!</h1>
          <Link
            from="/posts/$postId"
            to="./info"
            search={(prev: any): any => ({ ...prev, more: true })}
          >
            To Information
          </Link>
        </>
      )
    }

    const detailsRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'details',
      component: DetailsComponent,
    })

    const InformationComponent = () => {
      return <h1>Information</h1>
    }

    const informationRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'info',
      component: InformationComponent,
      validateSearch: () => ({ more: false }),
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          postsRoute.addChildren([
            postRoute.addChildren([detailsRoute, informationRoute]),
          ]),
        ]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'To first post' })

    expect(postsLink).toHaveAttribute('href', '/posts/id1/details?page=2')

    fireEvent.click(postsLink)

    const paramsText1 = await screen.findByText('Params: id1')
    expect(paramsText1).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/details')

    const informationLink = await screen.findByRole('link', {
      name: 'To Information',
    })

    expect(informationLink).toHaveAttribute(
      'href',
      '/posts/id1/info?page=2&more=true',
    )

    fireEvent.click(informationLink)

    const informationText = await screen.findByText('Information')
    expect(informationText).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/info')

    const paramsText2 = await screen.findByText('Params: id1')
    expect(paramsText2).toBeInTheDocument()

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating from /posts/$postId to ../$postId and the current route is /posts/$postId/details', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
            <Link to="/posts/$postId/details" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const DetailsComponent = () => {
      return (
        <>
          <h1>Details!</h1>
          <Link from="/posts/$postId" to="../$postId">
            To Post
          </Link>
        </>
      )
    }

    const detailsRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'details',
      component: DetailsComponent,
    })

    const InformationComponent = () => {
      return <h1>Information</h1>
    }

    const informationRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'info',
      component: InformationComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          postsRoute.addChildren([
            postRoute.addChildren([detailsRoute, informationRoute]),
          ]),
        ]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'To first post' })

    expect(postsLink).toHaveAttribute('href', '/posts/id1/details')

    fireEvent.click(postsLink)

    const paramsText1 = await screen.findByText('Params: id1')
    expect(paramsText1).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/details')

    const postLink = await screen.findByRole('link', {
      name: 'To Post',
    })

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.click(postLink)

    const postsText = await screen.findByText('Posts')
    expect(postsText).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1')

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating from /posts/$postId with an index to ../$postId and the current route is /posts/$postId/details', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
            <Link to="/posts/$postId/details" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const postIndexRoute = createRoute({
      getParentRoute: () => postRoute,
      path: '/',
      component: PostComponent,
    })

    const DetailsComponent = () => {
      return (
        <>
          <h1>Details!</h1>
          <Link from="/posts/$postId" to="../$postId">
            To Post
          </Link>
        </>
      )
    }

    const detailsRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'details',
      component: DetailsComponent,
    })

    const InformationComponent = () => {
      return <h1>Information</h1>
    }

    const informationRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'info',
      component: InformationComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          postsRoute.addChildren([
            postRoute.addChildren([
              postIndexRoute,
              detailsRoute,
              informationRoute,
            ]),
          ]),
        ]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'To first post' })

    expect(postsLink).toHaveAttribute('href', '/posts/id1/details')

    fireEvent.click(postsLink)

    const paramsText1 = await screen.findByText('Params: id1')
    expect(paramsText1).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/details')

    const postLink = await screen.findByRole('link', {
      name: 'To Post',
    })

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.click(postLink)

    const postsText = await screen.findByText('Posts')
    expect(postsText).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1')

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating from /invoices to ./invoiceId and the current route is /posts/$postId/details', async () => {
    const rootRoute = createRootRoute({
      errorComponent: (err) => <div>{err.error.message}</div>,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts">Posts</Link>
            <Link to="/posts/$postId/details" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const DetailsComponent = () => {
      return (
        <>
          <h1>Details!</h1>
          <Link
            from="/invoices"
            to="./$invoiceId"
            params={{ invoiceId: 'id1' }}
          >
            To Invoices
          </Link>
        </>
      )
    }

    const detailsRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'details',
      component: DetailsComponent,
    })

    const InformationComponent = () => {
      return <h1>Information</h1>
    }

    const informationRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'info',
      component: InformationComponent,
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
      component: () => (
        <>
          <h1>Invoices!</h1>
          <Outlet />
        </>
      ),
    })

    const InvoiceComponent = () => {
      const params = useParams({ strict: false })
      return <span>invoiceId: {params().invoiceId}</span>
    }

    const invoiceRoute = createRoute({
      getParentRoute: () => invoicesRoute,
      path: '$invoiceId',
      component: InvoiceComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          invoicesRoute.addChildren([invoiceRoute]),
          postsRoute.addChildren([
            postRoute.addChildren([detailsRoute, informationRoute]),
          ]),
        ]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'To first post' })

    expect(postsLink).toHaveAttribute('href', '/posts/id1/details')

    fireEvent.click(postsLink)
  })

  test('when navigating to /posts/$postId/info which is declaratively masked as /posts/$postId', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts/$postId/info" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const InformationComponent = () => {
      return <h1>Information</h1>
    }

    const informationRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'info',
      component: InformationComponent,
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      postsRoute.addChildren([postRoute.addChildren([informationRoute])]),
    ])

    const routeMask = createRouteMask({
      routeTree,
      from: '/posts/$postId/info',
      to: '/posts/$postId',
    })

    const router = createRouter({
      routeTree,
      routeMasks: [routeMask],
    })

    render(() => <RouterProvider router={router} />)

    const informationLink = await screen.findByRole('link', {
      name: 'To first post',
    })

    expect(informationLink).toHaveAttribute('href', '/posts/id1')

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating to /posts/$postId/info which is imperatively masked as /posts/$postId', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link
              to="/posts/$postId/info"
              params={{ postId: 'id1' }}
              mask={{ to: '/posts/$postId', params: { postId: 'id1' } }}
            >
              To first post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const InformationComponent = () => {
      return <h1>Information</h1>
    }

    const informationRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'info',
      component: InformationComponent,
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      postsRoute.addChildren([postRoute.addChildren([informationRoute])]),
    ])

    const router = createRouter({
      routeTree,
    })

    render(() => <RouterProvider router={router} />)

    const informationLink = await screen.findByRole('link', {
      name: 'To first post',
    })

    expect(informationLink).toHaveAttribute('href', '/posts/id1')

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when preloading /post/$postId with a redirects to /login', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts/$postId" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const loaderFn = vi.fn()

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const search = vi.fn((prev) => ({ page: prev.postPage }))

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
      validateSearch: () => ({ postPage: 0 }),
      loader: () => {
        loaderFn()
        throw redirect({
          to: '/login',
          search,
        })
      },
    })

    const LoginComponent = () => {
      const [status, setStatus] = Solid.createSignal<
        'idle' | 'success' | 'error'
      >('idle')

      Solid.onMount(() => {
        const onLoad = async () => {
          try {
            await router.preloadRoute({
              to: '/posts/$postId',
              params: { postId: 'id1' },
              search: { postPage: 0 },
            })
            setStatus('success')
          } catch (e) {
            setStatus('error')
          }
        }
        onLoad()
      })

      return <>{status() === 'success' ? 'Login!' : 'Waiting...'}</>
    }

    const loginRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'login',
      component: LoginComponent,
      validateSearch: () => ({ page: 0 }),
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      loginRoute,
      postsRoute.addChildren([postRoute]),
    ])

    const router = createRouter({
      routeTree,
      defaultPreload: 'intent',
    })

    render(() => <RouterProvider router={router} />)

    const postLink = await screen.findByRole('link', {
      name: 'To first post',
    })

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.mouseOver(postLink)

    await waitFor(() => expect(loaderFn).toHaveBeenCalled())

    await waitFor(() => expect(search).toHaveBeenCalledWith({ postPage: 0 }))

    fireEvent.click(postLink)

    const loginText = await screen.findByText('Login!')
    expect(loginText).toBeInTheDocument()

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating to /post/$postId with a redirect from /post/$postId to ../../login in a loader', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts/$postId" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const search = vi.fn((prev) => ({ page: prev.postPage }))

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
      validateSearch: () => ({ postPage: 0 }),
      loader: () => {
        throw redirect({
          from: postRoute.fullPath,
          to: '../../login',
          search,
        })
      },
    })

    const LoginComponent = () => {
      return <>Login!</>
    }

    const loginRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'login',
      component: LoginComponent,
      validateSearch: () => ({ page: 0 }),
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      loginRoute,
      postsRoute.addChildren([postRoute]),
    ])

    const router = createRouter({
      routeTree,
    })

    render(() => <RouterProvider router={router} />)

    const postLink = await screen.findByRole('link', {
      name: 'To first post',
    })

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.click(postLink)

    const loginText = await screen.findByText('Login!')
    expect(loginText).toBeInTheDocument()

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating to /post/$postId with a redirect from /post/$postId to ../../login in beforeLoad', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts/$postId" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const search = vi.fn((prev) => ({ page: prev.postPage }))

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
      validateSearch: () => ({ postPage: 0 }),
      beforeLoad: () => {
        throw redirect({
          from: postRoute.fullPath,
          to: '../../login',
          search,
        })
      },
    })

    const LoginComponent = () => {
      return <>Login!</>
    }

    const loginRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'login',
      component: LoginComponent,
      validateSearch: () => ({ page: 0 }),
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      loginRoute,
      postsRoute.addChildren([postRoute]),
    ])

    const router = createRouter({
      routeTree,
    })

    render(() => <RouterProvider router={router} />)

    const postLink = await screen.findByRole('link', {
      name: 'To first post',
    })

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.click(postLink)

    const loginText = await screen.findByText('Login!')
    expect(loginText).toBeInTheDocument()

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when preloading /post/$postId with a beforeLoad that navigates to /login', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts/$postId" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const search = vi.fn((prev) => ({ page: prev.postPage }))

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
      validateSearch: () => ({ postPage: 0 }),
      beforeLoad: (context) => context.navigate({ to: '/login', search }),
    })

    const LoginComponent = () => {
      return <>Login!</>
    }

    const loginRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'login',
      component: LoginComponent,
      validateSearch: () => ({ page: 0 }),
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      loginRoute,
      postsRoute.addChildren([postRoute]),
    ])

    const router = createRouter({
      routeTree,
      defaultPreload: 'intent',
    })

    render(() => <RouterProvider router={router} />)

    const postLink = await screen.findByRole('link', {
      name: 'To first post',
    })

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.mouseOver(postLink)

    await waitFor(() => expect(search).toHaveBeenCalledWith({ postPage: 0 }))

    fireEvent.click(postLink)

    await sleep(WAIT_TIME)

    const loginText = await screen.findByText('Login!')
    expect(loginText).toBeInTheDocument()

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when preloading /post/$postId with a loader that navigates to /login', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts/$postId" params={{ postId: 'id1' }}>
              To first post
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const search = vi.fn((prev) => ({ page: prev.postPage }))

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
      validateSearch: () => ({ postPage: 0 }),
      loader: (context) => {
        context.navigate({ to: '/login', search })
      },
    })

    const LoginComponent = () => {
      return <>Login!</>
    }

    const loginRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'login',
      component: LoginComponent,
      validateSearch: () => ({ page: 0 }),
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      loginRoute,
      postsRoute.addChildren([postRoute]),
    ])

    const router = createRouter({
      routeTree,
      defaultPreload: 'intent',
    })

    render(() => <RouterProvider router={router} />)

    const postLink = await screen.findByRole('link', {
      name: 'To first post',
    })

    expect(postLink).toHaveAttribute('href', '/posts/id1')

    fireEvent.mouseOver(postLink)

    await waitFor(() => expect(search).toHaveBeenCalledWith({ postPage: 0 }))

    fireEvent.click(postLink)

    const loginText = await screen.findByText('Login!')
    expect(loginText).toBeInTheDocument()

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating from /posts to /invoices with conditionally rendering Link on the root', async () => {
    const ErrorComponent = vi.fn(() => <div>Something went wrong!</div>)
    const RootComponent = () => {
      const matchRoute = useMatchRoute()
      const matchPosts = matchRoute({ to: '/posts' })
      const matchInvoices = matchRoute({ to: '/invoices' })

      return (
        <>
          {Boolean(matchPosts()) && (
            <Link from="/posts" to="/posts">
              From posts
            </Link>
          )}
          {Boolean(matchInvoices()) && (
            <Link from="/invoices" to="/invoices">
              From invoices
            </Link>
          )}
          <Outlet />
        </>
      )
    }

    const rootRoute = createRootRoute({
      component: RootComponent,
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <>
          <h1>Index Route</h1>
          <Link to="/posts">Go to posts</Link>
        </>
      ),
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      component: () => (
        <>
          <h1>On Posts</h1>
          <Link to="/invoices">To invoices</Link>
        </>
      ),
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
      component: () => (
        <>
          <h1>On Invoices</h1>
          <Link to="/posts">To posts</Link>
        </>
      ),
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      postsRoute,
      invoicesRoute,
    ])

    const router = createRouter({
      routeTree,
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Go to posts' })

    fireEvent.click(postsLink)

    const fromPostsLink = await screen.findByRole('link', {
      name: 'From posts',
    })

    expect(fromPostsLink).toBeInTheDocument()

    const toInvoicesLink = await screen.findByRole('link', {
      name: 'To invoices',
    })

    fireEvent.click(toInvoicesLink)

    const fromInvoicesLink = await screen.findByRole('link', {
      name: 'From invoices',
    })

    expect(fromInvoicesLink).toBeInTheDocument()

    expect(fromPostsLink).not.toBeInTheDocument()

    const toPostsLink = await screen.findByRole('link', {
      name: 'To posts',
    })

    fireEvent.click(toPostsLink)

    const onPostsText = await screen.findByText('On Posts')
    expect(onPostsText).toBeInTheDocument()

    expect(fromInvoicesLink).not.toBeInTheDocument()

    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when linking to self with from prop set and param containing a slash', async () => {
    const ErrorComponent = vi.fn(() => <h1>Something went wrong!</h1>)

    const rootRoute = createRootRoute({
      errorComponent: ErrorComponent,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <Link to="/$postId" params={{ postId: 'id/with-slash' }}>
          Go to post
        </Link>
      ),
    })

    const postRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/$postId',
      component: () => (
        <Link from="/$postId" to="/$postId">
          Link to self with from prop set
        </Link>
      ),
    })

    const routeTree = rootRoute.addChildren([indexRoute, postRoute])
    const router = createRouter({ routeTree })

    render(() => <RouterProvider router={router} />)

    const postLink = await screen.findByRole('link', {
      name: 'Go to post',
    })

    expect(postLink).toHaveAttribute('href', '/id%2Fwith-slash')

    fireEvent.click(postLink)

    const selfLink = await screen.findByRole('link', {
      name: 'Link to self with from prop set',
    })

    expect(selfLink).toBeInTheDocument()
    expect(ErrorComponent).not.toHaveBeenCalled()
  })

  test('when navigating to /$postId with parseParams and stringifyParams', async () => {
    const rootRoute = createRootRoute()

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <Link to="/$postId" params={{ postId: 2 }}>
          Go to post
        </Link>
      ),
    })

    let parseParams: any
    let stringifyParams: any

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return <div>Post: {params().postId}</div>
    }

    const postRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '$postId',
      parseParams: (params) => {
        parseParams = structuredClone(params) // clone object, because source will get mutated
        return {
          status: 'parsed',
          postId: params.postId,
        }
      },
      stringifyParams: (params) => {
        stringifyParams = structuredClone(params) // clone object, because source will get mutated
        return {
          status: 'stringified',
          postId: params.postId,
        }
      },
      component: PostComponent,
    })

    const routeTree = rootRoute.addChildren([indexRoute, postRoute])
    const router = createRouter({ routeTree })

    render(() => <RouterProvider router={router} />)

    const postLink = await screen.findByRole('link', {
      name: 'Go to post',
    })

    expect(stringifyParams).toEqual({ postId: 2 })

    expect(postLink).toHaveAttribute('href', '/2')

    fireEvent.click(postLink)

    const posts2Text = await screen.findByText('Post: 2')
    expect(posts2Text).toBeInTheDocument()

    expect(parseParams).toEqual({ postId: '2' })
  })

  test('when navigating to /$postId with params.parse and params.stringify', async () => {
    const rootRoute = createRootRoute()

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <Link to="/$postId" params={{ postId: 2 }}>
          Go to post
        </Link>
      ),
    })

    let parseParams: any
    let stringifyParams: any

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return <div>Post: {params().postId}</div>
    }

    const postRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '$postId',
      params: {
        parse: (params) => {
          parseParams = structuredClone(params) // clone object, because source will get mutated
          return {
            status: 'parsed',
            postId: params.postId,
          }
        },
        stringify: (params) => {
          stringifyParams = structuredClone(params) // clone object, because source will get mutated
          return {
            status: 'stringified',
            postId: params.postId,
          }
        },
      },
      component: PostComponent,
    })

    const routeTree = rootRoute.addChildren([indexRoute, postRoute])
    const router = createRouter({ routeTree })

    render(() => <RouterProvider router={router} />)

    const postLink = await screen.findByRole('link', {
      name: 'Go to post',
    })

    expect(stringifyParams).toEqual({ postId: 2 })

    expect(postLink).toHaveAttribute('href', '/2')

    fireEvent.click(postLink)

    const posts2Text = await screen.findByText('Post: 2')
    expect(posts2Text).toBeInTheDocument()

    expect(parseParams).toEqual({ postId: '2' })
  })

  test('when navigating to /$postId with params.parse and params.stringify handles falsey inputs', async () => {
    const rootRoute = createRootRoute()

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <>
          <Link to="/$postId" params={{ postId: 2 }}>
            Go to post 2
          </Link>
          <Link to="/$postId" params={{ postId: 0 }}>
            Go to post 0
          </Link>
        </>
      ),
    })

    const stringifyParamsMock = vi.fn()

    const parseParams = ({ postId }: { postId: string }) => {
      return {
        postId: parseInt(postId),
      }
    }

    const stringifyParams = ({ postId }: { postId: number }) => {
      stringifyParamsMock({ postId })
      return {
        postId: postId.toString(),
      }
    }

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return <div>Post: {params().postId}</div>
    }

    const postRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '$postId',
      params: {
        parse: parseParams,
        stringify: stringifyParams,
      },
      component: PostComponent,
    })

    const routeTree = rootRoute.addChildren([indexRoute, postRoute])
    const router = createRouter({ routeTree })

    render(() => <RouterProvider router={router} />)

    const postLink2 = await screen.findByRole('link', {
      name: 'Go to post 2',
    })
    const postLink0 = await screen.findByRole('link', {
      name: 'Go to post 0',
    })

    expect(postLink2).toHaveAttribute('href', '/2')
    expect(postLink0).toHaveAttribute('href', '/0')

    expect(stringifyParamsMock).toHaveBeenCalledWith({ postId: 2 })
    expect(stringifyParamsMock).toHaveBeenCalledWith({ postId: 0 })
  })

  test.each([false, 'intent', 'render'] as const)(
    'Router.preload="%s", should not trigger the IntersectionObserver\'s observe and disconnect methods',
    async (preload) => {
      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => (
          <>
            <h1>Index Heading</h1>
            <Link to="/">Index Link</Link>
          </>
        ),
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute]),
        defaultPreload: preload,
      })

      render(() => <RouterProvider router={router} />)

      const indexLink = await screen.findByRole('link', { name: 'Index Link' })
      expect(indexLink).toBeInTheDocument()

      expect(ioObserveMock).not.toBeCalled()
      expect(ioDisconnectMock).not.toBeCalled()
    },
  )

  test.each([false, 'intent', 'viewport', 'render'] as const)(
    'Router.preload="%s" with Link.preload="false", should not trigger the IntersectionObserver\'s observe method',
    async (preload) => {
      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => (
          <>
            <h1>Index Heading</h1>
            <Link to="/" preload={false}>
              Index Link
            </Link>
          </>
        ),
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute]),
        defaultPreload: preload,
      })

      render(() => <RouterProvider router={router} />)

      const indexLink = await screen.findByRole('link', { name: 'Index Link' })
      expect(indexLink).toBeInTheDocument()

      expect(ioObserveMock).not.toBeCalled()
    },
  )

  test('Router.preload="viewport", should trigger the IntersectionObserver\'s observe and disconnect methods', async () => {
    const rootRoute = createRootRoute()
    const RouteComponent = () => {
      const [count, setCount] = Solid.createSignal(0)
      return (
        <>
          <h1>Index Heading</h1>
          <output>{count()}</output>
          <button onClick={() => setCount((c) => c + 1)}>Render</button>
          <Link to="/">Index Link</Link>
        </>
      )
    }
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: RouteComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      defaultPreload: 'viewport',
    })

    render(() => <RouterProvider router={router} />)

    const indexLink = await screen.findByRole('link', { name: 'Index Link' })
    expect(indexLink).toBeInTheDocument()

    expect(ioObserveMock).toHaveBeenCalledOnce()
    expect(ioDisconnectMock).not.toHaveBeenCalled()

    const output = screen.getByRole('status')
    expect(output).toHaveTextContent('0')

    const button = screen.getByRole('button', { name: 'Render' })
    fireEvent.click(button)
    await waitFor(() => {
      expect(output).toHaveTextContent('1')
    })
    expect(ioObserveMock).toHaveBeenCalledOnce() // it should not observe again
    expect(ioDisconnectMock).not.toHaveBeenCalled() // it should not disconnect again
  })

  test("Router.preload='render', should trigger the route loader on render", async () => {
    const mock = vi.fn()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      loader: () => {
        mock()
      },
      component: () => (
        <>
          <h1>Index Heading</h1>
          <Link to="/about">About Link</Link>
        </>
      ),
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      component: () => (
        <>
          <h1>About Heading</h1>
        </>
      ),
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([aboutRoute, indexRoute]),
      defaultPreload: 'render',
    })

    render(() => <RouterProvider router={router} />)

    const aboutLink = await screen.findByRole('link', { name: 'About Link' })
    expect(aboutLink).toBeInTheDocument()

    expect(mock).toHaveBeenCalledTimes(1)
  })

  test.each([undefined, false, 'render', 'viewport'] as const)(
    'Link.preload="%s" should not preload on focus, hover, or touchstart',
    async (preloadMode) => {
      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => (
          <>
            <h1>Index Heading</h1>
            <Link
              to="/about"
              {...(preloadMode === undefined ? {} : { preload: preloadMode })}
            >
              About Link
            </Link>
          </>
        ),
      })
      const aboutRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/about',
        component: () => <h1>About Heading</h1>,
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([aboutRoute, indexRoute]),
        defaultPreload: false,
        defaultPreloadDelay: 0,
        history,
      })

      const preloadRouteSpy = vi.spyOn(router, 'preloadRoute')

      render(() => <RouterProvider router={router} />)

      const aboutLink = await screen.findByRole('link', { name: 'About Link' })
      expect(aboutLink).toBeInTheDocument()

      if (preloadMode === 'render') {
        await waitFor(() =>
          expect(preloadRouteSpy.mock.calls.length).toBeGreaterThan(0),
        )
      }

      const baselineCalls = preloadRouteSpy.mock.calls.length

      fireEvent.focus(aboutLink)
      fireEvent.mouseOver(aboutLink)
      fireEvent.touchStart(aboutLink)

      await sleep(100)
      expect(preloadRouteSpy).toHaveBeenCalledTimes(baselineCalls)
    },
  )

  test('Link.preload="intent" should preload on focus, hover, and touchstart', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <>
          <h1>Index Heading</h1>
          <Link to="/about" preload="intent">
            About Link
          </Link>
        </>
      ),
    })
    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      component: () => <h1>About Heading</h1>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([aboutRoute, indexRoute]),
      defaultPreload: false,
      defaultPreloadDelay: 0,
      history,
    })

    const preloadRouteSpy = vi.spyOn(router, 'preloadRoute')

    render(() => <RouterProvider router={router} />)

    const aboutLink = await screen.findByRole('link', { name: 'About Link' })
    expect(aboutLink).toBeInTheDocument()

    const baselineCalls = preloadRouteSpy.mock.calls.length

    fireEvent.focus(aboutLink)
    await waitFor(() =>
      expect(preloadRouteSpy).toHaveBeenCalledTimes(baselineCalls + 1),
    )

    fireEvent.mouseOver(aboutLink)
    await waitFor(() =>
      expect(preloadRouteSpy).toHaveBeenCalledTimes(baselineCalls + 2),
    )

    fireEvent.touchStart(aboutLink)
    await waitFor(() =>
      expect(preloadRouteSpy).toHaveBeenCalledTimes(baselineCalls + 3),
    )
  })

  test('Router.preload="intent", pendingComponent renders during unresolved route loader', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <div>
            <h1>Index page</h1>
            <Link to="/posts" preload="intent">
              link to posts
            </Link>
          </div>
        )
      },
    })

    const postRoute = createRoute({
      ssr: false,
      getParentRoute: () => rootRoute,
      path: '/posts',
      loader: () => sleep(WAIT_TIME),
      component: () => <div>Posts page</div>,
    })

    const routeTree = rootRoute.addChildren([postRoute, indexRoute])
    const router = createRouter({
      routeTree,
      defaultPreload: 'intent',
      defaultPendingMs: 200,
      defaultPendingComponent: () => <p>Loading...</p>,
    })

    render(() => <RouterProvider router={router} />)

    const linkToPosts = await screen.findByRole('link', {
      name: 'link to posts',
    })
    expect(linkToPosts).toBeInTheDocument()

    fireEvent.focus(linkToPosts)
    fireEvent.click(linkToPosts)

    const loadingElement = await screen.findByText('Loading...')
    expect(loadingElement).toBeInTheDocument()

    const postsElement = await screen.findByText('Posts page')
    expect(postsElement).toBeInTheDocument()

    expect(window.location.pathname).toBe('/posts')
  })

  describe('when preloading a link, `preload` should be', () => {
    async function runTest({
      expectedPreload,
      testIdToHover,
    }: {
      expectedPreload: boolean
      testIdToHover: string
    }) {
      const rootRoute = createRootRoute({
        component: () => {
          return (
            <>
              <Link
                data-testid="link-1"
                to="/posts/$postId"
                params={{ postId: 'id1' }}
              >
                To first post
              </Link>
              <Link
                data-testid="link-2"
                to="/posts/$postId"
                params={{ postId: 'id2' }}
              >
                To second post
              </Link>
              <Outlet />
            </>
          )
        },
      })

      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => {
          return (
            <>
              <h1>Index</h1>
            </>
          )
        },
      })

      const PostsComponent = () => {
        return (
          <>
            <h1>Posts</h1>
            <Outlet />
          </>
        )
      }

      const postsBeforeLoadFn = vi.fn()
      const postsLoaderFn = vi.fn()

      const postsRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'posts',
        component: PostsComponent,
        beforeLoad: postsBeforeLoadFn,
        loader: postsLoaderFn,
      })

      const PostComponent = () => {
        const params = useParams({ strict: false })
        return (
          <>
            <span>Params: {params().postId}</span>
          </>
        )
      }

      const postBeforeLoadFn = vi.fn()
      const postLoaderFn = vi.fn()

      const postRoute = createRoute({
        getParentRoute: () => postsRoute,
        path: '$postId',
        component: PostComponent,
        beforeLoad: postBeforeLoadFn,
        loader: postLoaderFn,
      })

      const routeTree = rootRoute.addChildren([
        indexRoute,
        postsRoute.addChildren([postRoute]),
      ])

      const router = createRouter({
        routeTree,
        defaultPreload: 'intent',
      })

      render(() => <RouterProvider router={router} />)
      const link = await screen.findByTestId(testIdToHover)
      fireEvent.mouseOver(link)

      const expected = expect.objectContaining({ preload: expectedPreload })
      await waitFor(() =>
        expect(postsBeforeLoadFn).toHaveBeenCalledWith(expected),
      )
      await waitFor(() => expect(postsLoaderFn).toHaveBeenCalledWith(expected))

      await waitFor(() =>
        expect(postBeforeLoadFn).toHaveBeenCalledWith(expected),
      )
      await waitFor(() => expect(postLoaderFn).toHaveBeenCalledWith(expected))
    }
    test('`true` when on / and hovering `/posts/id1` ', async () => {
      await runTest({ expectedPreload: true, testIdToHover: 'link-1' })
    })

    test('`false` when on `/posts/id1` and hovering `/posts/id1`', async () => {
      window.history.replaceState(null, 'root', '/posts/id1')
      await runTest({ expectedPreload: false, testIdToHover: 'link-1' })
    })

    test('`true` when on `/posts/id1` and hovering `/posts/id2`', async () => {
      window.history.replaceState(null, 'root', '/posts/id1')
      await runTest({ expectedPreload: false, testIdToHover: 'link-2' })
    })
  })
})

describe('createLink', () => {
  it('should pass the "disabled" prop to the rendered target element', async () => {
    const CustomLink = createLink('button')

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <CustomLink to="/" disabled>
          Index
        </CustomLink>
      ),
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const customElement = await screen.findByText('Index')

    expect(customElement).toBeDisabled()
    expect(customElement.getAttribute('disabled')).toBe('')
  })

  it('should pass the "foo" prop to the rendered target element', async () => {
    const CustomLink = createLink('button')

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <CustomLink
          to="/"
          // @ts-expect-error
          foo="bar"
        >
          Index
        </CustomLink>
      ),
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const customElement = await screen.findByText('Index')

    expect(customElement.hasAttribute('foo')).toBe(true)
    expect(customElement.getAttribute('foo')).toBe('bar')
  })

  it('should pass activeProps and inactiveProps to the custom link', async () => {
    const Button: Solid.Component<
      Solid.ParentProps<{
        active?: boolean
        foo?: boolean
        overrideMeIfYouWant: string
      }>
    > = (props) => {
      const [local, rest] = Solid.splitProps(props, [
        'active',
        'foo',
        'children',
      ])

      return (
        <button {...rest}>
          active: {local.active ? 'yes' : 'no'} - foo:{' '}
          {local.foo ? 'yes' : 'no'} - {local.children}
        </button>
      )
    }

    const ButtonLink = createLink(Button)

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <>
          <ButtonLink
            to="/"
            overrideMeIfYouWant="Button1"
            activeProps={{
              active: true,
              'data-hello': 'world',
              overrideMeIfYouWant: 'overridden-by-activeProps',
            }}
            inactiveProps={{ foo: true }}
          >
            Button1
          </ButtonLink>
          <ButtonLink
            to="/posts"
            overrideMeIfYouWant="Button2"
            activeProps={{
              active: true,
              'data-hello': 'world',
            }}
            inactiveProps={{
              foo: true,
              'data-hello': 'void',
              overrideMeIfYouWant: 'overridden-by-inactiveProps',
            }}
          >
            Button2
          </ButtonLink>
          <ButtonLink
            to="/posts"
            overrideMeIfYouWant="Button3"
            activeProps={{
              active: true,
            }}
            inactiveProps={{
              active: false,
            }}
          >
            Button3
          </ButtonLink>
        </>
      ),
    })
    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
    })

    render(() => <RouterProvider router={router} />)

    const button1 = await screen.findByText('active: yes - foo: no - Button1')
    expect(button1.getAttribute('data-hello')).toBe('world')
    expect(button1.getAttribute('overrideMeIfYouWant')).toBe(
      'overridden-by-activeProps',
    )

    const button2 = await screen.findByText('active: no - foo: yes - Button2')
    expect(button2.getAttribute('data-hello')).toBe('void')
    expect(button2.getAttribute('overrideMeIfYouWant')).toBe(
      'overridden-by-inactiveProps',
    )

    const button3 = await screen.findByText('active: no - foo: no - Button3')
    expect(button3.getAttribute('overrideMeIfYouWant')).toBe('Button3')
  })

  it('should respect target attribute set by custom component', async () => {
    const CustomLinkWithTarget = (props: {
      href?: string
      children?: Solid.JSX.Element
      ref?: (el: HTMLAnchorElement) => void
    }) => (
      <a ref={props.ref} {...props} target="_blank" rel="noopener noreferrer" />
    )

    const CreatedCustomLink = createLink(CustomLinkWithTarget)

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <>
          <h1>Index</h1>
          <CreatedCustomLink to="/posts">
            Posts (should open in new tab)
          </CreatedCustomLink>
        </>
      ),
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => <h1 data-testid="posts-heading">Posts</h1>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    const originalOpen = window.open
    const openMock = vi.fn()
    window.open = openMock

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', {
      name: 'Posts (should open in new tab)',
    })

    expect(postsLink).toHaveAttribute('target', '_blank')
    expect(postsLink).toHaveAttribute('rel', 'noopener noreferrer')

    fireEvent.click(postsLink)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })

    await expect(screen.findByTestId('posts-heading')).rejects.toThrow()

    window.open = originalOpen
  })

  it('should allow override of target prop even when custom component sets it', async () => {
    const CustomLinkWithDefaultTarget = (props: {
      href?: string
      children?: Solid.JSX.Element
      target?: string
      ref?: (el: HTMLAnchorElement) => void
    }) => <a ref={props.ref} target="_blank" {...props} />

    const CreatedCustomLink = createLink(CustomLinkWithDefaultTarget)

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <>
          <h1>Index</h1>
          <CreatedCustomLink to="/posts" target="_self">
            Posts (should navigate internally)
          </CreatedCustomLink>
        </>
      ),
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => <h1 data-testid="posts-heading">Posts</h1>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', {
      name: 'Posts (should navigate internally)',
    })

    expect(postsLink).toHaveAttribute('target', '_self')

    fireEvent.click(postsLink)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/posts')
    })

    const postsHeading = await screen.findByTestId('posts-heading')
    expect(postsHeading).toBeInTheDocument()
  })
})

describe('search middleware', () => {
  test('legacy search filters still work', async () => {
    const rootRoute = createRootRoute({
      validateSearch: (input) => {
        return {
          root: input.root as string | undefined,
          foo: input.foo as string | undefined,
        }
      },
      preSearchFilters: [
        (search) => {
          return { ...search, foo: 'foo' }
        },
      ],
      postSearchFilters: [
        (search) => {
          return { ...search, root: search.root ?? 'default' }
        },
      ],
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link to="/posts" search={(p: any) => ({ page: 123, foo: p.foo })}>
              Posts
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      validateSearch: (input: Record<string, unknown>) => {
        const page = Number(input.page)
        return {
          page,
        }
      },
      component: PostsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
      history: createMemoryHistory({ initialEntries: ['/?foo=bar'] }),
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByRole('link', { name: 'Posts' })
    expect(postsLink).toHaveAttribute('href')
    const href = postsLink.getAttribute('href')
    const search = getSearchParamsFromURI(href!)
    expect(search.size).toBe(3)
    expect(search.get('page')).toBe('123')
    expect(search.get('root')).toBe('default')
    expect(search.get('foo')).toBe('foo')
  })

  test('search middlewares work', async () => {
    const rootRoute = createRootRoute({
      errorComponent: (error) => <div>{error.error.stack}</div>,
      validateSearch: (input) => {
        return {
          root: input.root as string | undefined,
          foo: input.foo as string | undefined,
        }
      },
      search: {
        middlewares: [
          ({ search, next }) => {
            return next({ ...search, foo: 'foo' })
          },
          ({ search, next }) => {
            expect(search.foo).toBe('foo')
            const { root, ...result } = next({ ...search, foo: 'hello' })
            return { ...result, root: root ?? search.root }
          },
        ],
      },
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        const search = indexRoute.useSearch()
        return (
          <>
            <h1>Index</h1>
            <div data-testid="search">{search().root ?? '$undefined'}</div>
            <Link
              data-testid="update-search"
              to="/"
              search={{ root: 'newValue' }}
            >
              update search
            </Link>
            <Link to="/posts" search={{ page: 123 }}>
              Posts
            </Link>
          </>
        )
      },
    })

    const PostsComponent = () => {
      return (
        <>
          <h1>Posts</h1>
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      validateSearch: (input: Record<string, unknown>) => {
        const page = Number(input.page)
        return {
          page,
        }
      },
      component: PostsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
      history: createMemoryHistory({ initialEntries: ['/?root=abc'] }),
    })

    render(() => <RouterProvider router={router} />)

    async function checkSearchValue(value: string) {
      const searchValue = await screen.findByTestId('search')
      expect(searchValue).toHaveTextContent(value)
    }
    async function checkPostsLink(root: string) {
      const postsLink = await screen.findByRole('link', { name: 'Posts' })
      expect(postsLink).toHaveAttribute('href')
      const href = postsLink.getAttribute('href')
      const search = getSearchParamsFromURI(href!)
      expect(search.size).toBe(2)
      expect(search.get('page')).toBe('123')
      expect(search.get('root')).toBe(root)
    }
    await checkSearchValue('abc')
    await checkPostsLink('abc')

    const updateSearchLink = await screen.findByTestId('update-search')
    fireEvent.click(updateSearchLink)
    await sleep(0)
    await checkSearchValue('newValue')
    await checkPostsLink('newValue')
    expect(router.state.location.search).toEqual({ root: 'newValue' })
  })

  test('search middlewares work with redirect', async () => {
    const rootRoute = createRootRoute({
      validateSearch: z.object({ root: z.string().optional() }),
      component: () => {
        return (
          <>
            <h1>Root</h1>
            <Link
              data-testid="root-link-posts"
              search={{ foo: 'default' }}
              to="/posts"
            >
              posts
            </Link>{' '}
            <Link data-testid="root-link-invoices" to="/invoices">
              invoices
            </Link>
            <Outlet />
          </>
        )
      },
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      beforeLoad: () => {
        throw redirect({ to: '/posts' })
      },
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'posts',
      validateSearch: z.object({
        foo: z.string().default('default'),
      }),
      search: {
        middlewares: [
          // this means we cannot get the correct input type for this schema
          stripSearchParams({ foo: 'default' }),
          retainSearchParams(true),
        ],
      },

      component: () => {
        const search = postsRoute.useSearch()
        return (
          <>
            <h1>Posts</h1>
            <div data-testid="posts-search">{search().foo}</div>
            <Link data-testid="posts-link-new" to="/posts/new">
              new
            </Link>
          </>
        )
      },
    })

    const postsNewRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: 'new',
    })

    const invoicesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: 'invoices',
    })
    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        postsRoute.addChildren([postsNewRoute]),
        invoicesRoute,
      ]),
    })

    window.history.replaceState(null, 'root', '/?root=abc')

    render(() => <RouterProvider router={router} />)

    const searchValue = await screen.findByTestId('posts-search')
    expect(searchValue).toHaveTextContent('default')

    expect(router.state.location.pathname).toBe('/posts')
    expect(router.state.location.search).toEqual({ root: 'abc' })

    // link to sibling does not retain search param
    const invoicesLink = await screen.findByTestId('root-link-invoices')
    expect(invoicesLink).toHaveAttribute('href')
    const invoicesLinkHref = invoicesLink.getAttribute('href')
    const invoicesLinkSearch = getSearchParamsFromURI(invoicesLinkHref!)
    expect(invoicesLinkSearch.size).toBe(0)

    // link to child retains search param
    const postsNewLink = await screen.findByTestId('posts-link-new')
    expect(postsNewLink).toHaveAttribute('href')
    const postsNewLinkHref = postsNewLink.getAttribute('href')
    const postsNewLinkSearch = getSearchParamsFromURI(postsNewLinkHref!)
    expect(postsNewLinkSearch.size).toBe(1)
    expect(postsNewLinkSearch.get('root')).toBe('abc')

    const postsLink = await screen.findByTestId('root-link-posts')
    expect(postsLink).toHaveAttribute('href')
    const postsLinkHref = postsNewLink.getAttribute('href')
    const postsLinkSearch = getSearchParamsFromURI(postsLinkHref!)
    expect(postsLinkSearch.size).toBe(1)
    expect(postsLinkSearch.get('root')).toBe('abc')
    expect(postsLink).toHaveAttribute('data-status', 'active')
  })

  describe('reloadDocument', () => {
    test('link to /posts with params', async () => {
      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => {
          return (
            <>
              <h1>Index</h1>
              <Link
                to="/posts/$postId"
                params={{ postId: 'id1' }}
                reloadDocument={true}
                data-testid="link-to-post-1"
              >
                To first post
              </Link>
            </>
          )
        },
      })

      const PostsComponent = () => {
        return (
          <>
            <h1>Posts</h1>
            <Link to="/">Index</Link>
            <Outlet />
          </>
        )
      }

      const postsRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'posts',
        component: PostsComponent,
      })

      const PostComponent = () => {
        const params = useParams({ strict: false })
        return <span>Params: {params().postId}</span>
      }

      const postRoute = createRoute({
        getParentRoute: () => postsRoute,
        path: '$postId',
        component: PostComponent,
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([
          indexRoute,
          postsRoute.addChildren([postRoute]),
        ]),
      })

      render(() => <RouterProvider router={router} />)

      const postLink = await screen.findByTestId('link-to-post-1')

      expect(postLink).toHaveAttribute('href', '/posts/id1')
    })
  })
})

describe.each([{ basepath: '' }, { basepath: '/basepath' }])(
  'relative links with %s',
  ({ basepath }) => {
    const setupRouter = () => {
      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => {
          return <h1>Index Route</h1>
        },
      })
      const aRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'a',
        component: () => {
          return (
            <>
              <h1>A Route</h1>
              <Outlet />
            </>
          )
        },
      })

      const bRoute = createRoute({
        getParentRoute: () => aRoute,
        path: 'b',
        component: () => {
          return (
            <>
              <h1>B Route</h1>
              <Link to="..">Link to Parent</Link>
            </>
          )
        },
      })

      const paramRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'param/$param',
        component: () => {
          return (
            <>
              <h1>Param Route</h1>
              <Link from={paramRoute.fullPath} to="./a">
                Link to ./a
              </Link>
              <Link to="c" unsafeRelative="path">
                Link to c
              </Link>
              <Link to="../c" unsafeRelative="path">
                Link to ../c
              </Link>
              <Outlet />
            </>
          )
        },
      })

      const paramARoute = createRoute({
        getParentRoute: () => paramRoute,
        path: 'a',
        component: () => {
          return (
            <>
              <h1>Param A Route</h1>
              <Link from={paramARoute.fullPath} to="..">
                Link to .. from /param/foo/a
              </Link>
              <Link to=".." data-testid={'link-to-previous'}>
                Link to .. from current active route
              </Link>
              <Outlet />
            </>
          )
        },
      })

      const paramBRoute = createRoute({
        getParentRoute: () => paramARoute,
        path: 'b',
        component: () => {
          return (
            <>
              <h1>Param B Route</h1>
              <Link to="..">Link to Parent</Link>
              <Link to="." params={{ param: 'bar' }}>
                Link to . with param:bar
              </Link>
              <Link to=".." params={{ param: 'bar' }}>
                Link to Parent with param:bar
              </Link>
              <paramBRoute.Link
                to=".."
                params={(prev) => ({ ...prev, param: 'bar' })}
              >
                Link to Parent with param:bar functional
              </paramBRoute.Link>
            </>
          )
        },
      })

      const paramCRoute = createRoute({
        getParentRoute: () => paramARoute,
        path: 'c',
        component: () => {
          return <h1>Param C Route</h1>
        },
      })

      const splatRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'splat/$',
        component: () => {
          return (
            <>
              <h1>Splat Route</h1>
              <Link to=".." unsafeRelative="path">
                Unsafe link to ..
              </Link>
              <Link to="." unsafeRelative="path">
                Unsafe link to .
              </Link>
              <Link to="./child" unsafeRelative="path">
                Unsafe link to ./child
              </Link>
            </>
          )
        },
      })

      return createRouter({
        routeTree: rootRoute.addChildren([
          indexRoute,
          aRoute.addChildren([bRoute]),
          paramRoute.addChildren([
            paramARoute.addChildren([paramBRoute, paramCRoute]),
          ]),
          splatRoute,
        ]),

        basepath: basepath === '' ? undefined : basepath,
      })
    }

    test('should navigate to the parent route', async () => {
      const router = setupRouter()

      render(() => <RouterProvider router={router} />)

      // Navigate to /a/b
      window.history.replaceState(null, 'root', `${basepath}/a/b`)

      // Inspect the link to go up a parent
      const parentLink = await screen.findByText('Link to Parent')
      expect(parentLink.getAttribute('href')).toBe(`${basepath}/a`)

      // Click the link and ensure the new location
      fireEvent.click(parentLink)

      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/a`),
      )
    })

    test('should navigate to the parent route and keep params', async () => {
      const router = setupRouter()

      render(() => <RouterProvider router={router} />)

      // Navigate to /param/oldParamValue/a/b
      window.history.replaceState(null, 'root', `${basepath}/param/foo/a/b`)

      // Inspect the link to go up a parent and keep the params
      const parentLink = await screen.findByText('Link to Parent')
      expect(parentLink.getAttribute('href')).toBe(`${basepath}/param/foo/a`)

      // Click the link and ensure the new location
      fireEvent.click(parentLink)

      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/param/foo/a`),
      )
    })

    test('should navigate to the parent route and change params', async () => {
      const router = setupRouter()

      render(() => <RouterProvider router={router} />)

      // Navigate to /param/oldParamValue/a/b
      window.history.replaceState(null, 'root', `${basepath}/param/foo/a/b`)

      // Inspect the link to go up a parent and keep the params
      const parentLink = await screen.findByText(
        'Link to Parent with param:bar',
      )
      expect(parentLink.getAttribute('href')).toBe(`${basepath}/param/bar/a`)

      // Click the link and ensure the new location
      fireEvent.click(parentLink)

      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/param/bar/a`),
      )
    })

    test('should navigate to a relative link based on render location', async () => {
      const router = setupRouter()

      render(() => <RouterProvider router={router} />)

      window.history.replaceState(null, 'root', `${basepath}/param/foo/a/b`)

      // Inspect the relative link to ./a
      const relativeLink = await screen.findByText('Link to ./a')
      expect(relativeLink.getAttribute('href')).toBe(`${basepath}/param/foo/a`)

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)

      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/param/foo/a`),
      )
    })

    test('should navigate to a parent link based on render location', async () => {
      const router = setupRouter()

      render(() => <RouterProvider router={router} />)

      window.history.replaceState(null, 'root', `${basepath}/param/foo/a/b`)

      // Inspect the relative link to ./a
      const relativeLink = await screen.findByText(
        'Link to .. from /param/foo/a',
      )
      expect(relativeLink.getAttribute('href')).toBe(`${basepath}/param/foo`)

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)

      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/param/foo`),
      )
    })

    test('should navigate to a parent link based on active location', async () => {
      const router = setupRouter()

      render(() => <RouterProvider router={router} />)

      window.history.replaceState(null, 'root', `${basepath}/param/foo/a/b`)

      const relativeLink = await screen.findByTestId('link-to-previous')

      expect(relativeLink.getAttribute('href')).toBe(`${basepath}/param/foo/a`)

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)

      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/param/foo/a`),
      )
    })

    test('should navigate to a child link based on pathname', async () => {
      const router = setupRouter()

      render(() => <RouterProvider router={router} />)

      window.history.replaceState(null, 'root', `${basepath}/param/foo/a/b`)

      // Inspect the relative link to ./a
      const relativeLink = await screen.findByText('Link to c')
      expect(relativeLink.getAttribute('href')).toBe(
        `${basepath}/param/foo/a/b/c`,
      )

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)

      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/param/foo/a/b/c`),
      )
    })

    test('should navigate to a relative link based on pathname', async () => {
      const router = setupRouter()

      render(() => <RouterProvider router={router} />)

      window.history.replaceState(null, 'root', `${basepath}/param/foo/a/b`)

      // Inspect the relative link to ./a
      const relativeLink = await screen.findByText('Link to ../c')
      expect(relativeLink.getAttribute('href')).toBe(
        `${basepath}/param/foo/a/c`,
      )

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)
      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/param/foo/a/c`),
      )
    })

    test('should navigate to parent inside of splat route based on pathname', async () => {
      const router = setupRouter()

      render(() => <RouterProvider router={router} />)

      window.history.replaceState(null, 'root', `${basepath}/splat/a/b/c/d`)

      const relativeLink = await screen.findByText('Unsafe link to ..')
      expect(relativeLink.getAttribute('href')).toBe(`${basepath}/splat/a/b/c`)

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)
      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/splat/a/b/c`),
      )
    })

    test('should navigate to same route inside of splat route based on pathname', async () => {
      const router = setupRouter()

      window.history.replaceState(null, 'root', `${basepath}/splat/a/b/c`)

      render(() => <RouterProvider router={router} />)

      const relativeLink = await screen.findByText('Unsafe link to .')
      expect(relativeLink.getAttribute('href')).toBe(`${basepath}/splat/a/b/c`)

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)

      expect(window.location.pathname).toBe(`${basepath}/splat/a/b/c`)
    })

    test('should navigate to child route inside of splat route based on pathname', async () => {
      const router = setupRouter()

      window.history.replaceState(null, 'root', `${basepath}/splat/a/b/c`)

      render(() => <RouterProvider router={router} />)

      const relativeLink = await screen.findByText('Unsafe link to ./child')
      expect(relativeLink.getAttribute('href')).toBe(
        `${basepath}/splat/a/b/c/child`,
      )

      // Click the link and ensure the new location
      fireEvent.click(relativeLink)
      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/splat/a/b/c/child`),
      )
    })

    test('should navigate to same route with different params', async () => {
      const router = setupRouter()

      window.history.replaceState(null, 'root', `${basepath}/param/foo/a/b`)

      render(() => <RouterProvider router={router} />)

      const parentLink = await screen.findByText('Link to . with param:bar')

      fireEvent.click(parentLink)

      await waitFor(() =>
        expect(window.location.pathname).toBe(`${basepath}/param/bar/a/b`),
      )
    })
  },
)

describe('splat routes with empty splat', () => {
  test.each(Object.values(trailingSlashOptions))(
    'should handle empty _splat parameter with trailingSlash: %s',
    async (trailingSlash) => {
      const tail = trailingSlash === 'always' ? '/' : ''

      const rootRoute = createRootRoute()
      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => {
          return (
            <>
              <h1>Index Route</h1>
              <Link
                data-testid="splat-link-with-empty-splat"
                to="/splat/$"
                params={{ _splat: '' }}
                activeProps={{ class: 'active' }}
              >
                Link to splat with _splat value
              </Link>
              <Link
                data-testid="splat-link-with-undefined-splat"
                to="/splat/$"
                params={{ _splat: undefined }}
                activeProps={{ class: 'active' }}
              >
                Link to splat with undefined _splat
              </Link>
              <Link
                data-testid="splat-link-with-no-splat"
                to="/splat/$"
                params={{}}
                activeProps={{ class: 'active' }}
              >
                Link to splat with no _splat at all
              </Link>
            </>
          )
        },
      })

      const splatRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: 'splat/$',
        component: () => {
          return <h1>Splat Route</h1>
        },
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute, splatRoute]),
        history,
        trailingSlash,
      })

      render(() => <RouterProvider router={router} />)

      const splatLinkWithEmptySplat = await screen.findByTestId(
        'splat-link-with-empty-splat',
      )
      const splatLinkWithUndefinedSplat = await screen.findByTestId(
        'splat-link-with-undefined-splat',
      )
      const splatLinkWithNoSplat = await screen.findByTestId(
        'splat-link-with-no-splat',
      )

      // When _splat has a value, it should follow the trailingSlash setting
      await waitFor(() => {
        expect(splatLinkWithEmptySplat.getAttribute('href')).toBe(
          `/splat${tail}`,
        )
        expect(splatLinkWithUndefinedSplat.getAttribute('href')).toBe(
          `/splat${tail}`,
        )
        expect(splatLinkWithNoSplat.getAttribute('href')).toBe(`/splat${tail}`)
      })

      // Click the link with empty _splat and ensure the route matches
      fireEvent.click(splatLinkWithEmptySplat)

      await waitFor(async () => {
        expect(splatLinkWithEmptySplat).toHaveClass('active')
        expect(splatLinkWithUndefinedSplat).toHaveClass('active')
        expect(splatLinkWithNoSplat).toHaveClass('active')
        expect(window.location.pathname).toBe(`/splat${tail}`)
        expect(await screen.findByText('Splat Route')).toBeInTheDocument()
      })
    },
  )
})

describe('relative links to current route', () => {
  test.each([true, false])(
    'should navigate to current route when using "." in nested route structure from Index Route with trailingSlash: %s',
    async (trailingSlash: boolean) => {
      const tail = trailingSlash ? '/' : ''

      const rootRoute = createRootRoute()

      const IndexComponent = () => {
        return (
          <>
            <Link data-testid="posts-link" to="/post">
              Post
            </Link>
            <Link
              data-testid="search-link"
              to="."
              search={{ param1: 'value1' }}
            >
              Search
            </Link>
            <Link
              data-testid="search2-link"
              to="."
              search={{ param1: 'value2' }}
            >
              Search2
            </Link>
            <Outlet />
          </>
        )
      }

      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: IndexComponent,
        validateSearch: z.object({
          param1: z.string().optional(),
        }),
      })

      const postRoute = createRoute({
        getParentRoute: () => indexRoute,
        path: 'post',
        component: () => (
          <>
            <div>Post</div>
          </>
        ),
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute, postRoute]),
        history,
        trailingSlash: trailingSlash ? 'always' : 'never',
      })

      render(() => <RouterProvider router={router} />)

      const postButton = await screen.findByTestId('posts-link')
      const searchButton = await screen.findByTestId('search-link')
      const searchButton2 = await screen.findByTestId('search2-link')

      fireEvent.click(postButton)

      await waitFor(() => {
        expect(window.location.pathname).toBe(`/post${tail}`)
      })

      fireEvent.click(searchButton)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/post${tail}`)
        expect(router.state.location.search).toEqual({ param1: 'value1' })
      })

      fireEvent.click(searchButton2)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/post${tail}`)
        expect(router.state.location.search).toEqual({ param1: 'value2' })
      })
    },
  )

  test.each([true, false])(
    'should navigate to current route with search params when using "." in nested route structure from Index Route with trailingSlash: %s',
    async (trailingSlash: boolean) => {
      const tail = trailingSlash ? '/' : ''

      const rootRoute = createRootRoute()

      const IndexComponent = () => {
        return (
          <>
            <Link data-testid="posts-link" to="/post">
              Post
            </Link>
            <Link
              data-testid="search-link"
              to="."
              search={{ param1: 'value1' }}
            >
              Search
            </Link>
            <Link
              data-testid="search2-link"
              to="/post"
              search={{ param1: 'value2' }}
            >
              Search2
            </Link>
            <Outlet />
          </>
        )
      }

      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: IndexComponent,
        validateSearch: z.object({
          param1: z.string().optional(),
        }),
      })

      const postRoute = createRoute({
        getParentRoute: () => indexRoute,
        path: 'post',
        component: () => <div>Post</div>,
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute, postRoute]),
        history,
        trailingSlash: trailingSlash ? 'always' : 'never',
      })

      render(() => <RouterProvider router={router} />)

      const postButton = await screen.findByTestId('posts-link')

      fireEvent.click(postButton)

      await waitFor(() => {
        expect(window.location.pathname).toBe(`/post${tail}`)
      })

      const searchButton = await screen.findByTestId('search-link')

      fireEvent.click(searchButton)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/post${tail}`)
        expect(router.state.location.search).toEqual({ param1: 'value1' })
      })

      const searchButton2 = await screen.findByTestId('search2-link')

      fireEvent.click(searchButton2)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/post${tail}`)
        expect(router.state.location.search).toEqual({ param1: 'value2' })
      })
    },
  )

  test.each([true, false])(
    'should navigate to current route with changing path params when using "." in nested route structure with trailingSlash: %s',
    async (trailingSlash) => {
      const tail = trailingSlash ? '/' : ''
      const rootRoute = createRootRoute()

      const IndexComponent = () => {
        return (
          <>
            <h1 data-testid="index-heading">Index</h1>
            <Link data-testid="posts-link" to="/posts">
              Posts
            </Link>
          </>
        )
      }

      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: IndexComponent,
      })

      const layoutRoute = createRoute({
        getParentRoute: () => rootRoute,
        id: '_layout',
        component: () => {
          return (
            <>
              <h1>Layout</h1>
              <Outlet />
            </>
          )
        },
      })

      const PostsComponent = () => {
        return (
          <>
            <h1 data-testid="posts-index-heading">Posts</h1>
            <Link
              data-testid="first-post-link"
              to="$postId"
              params={{ postId: 'id1' }}
            >
              To first post
            </Link>
            <Link
              data-testid="second-post-link"
              to="."
              params={{ postId: 'id2' }}
            >
              To second post
            </Link>
            <Outlet />
          </>
        )
      }

      const postsRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'posts',
        component: PostsComponent,
      })

      const PostComponent = () => {
        const params = useParams({ strict: false })
        return (
          <>
            <span data-testid={`post-${params().postId}`}>
              Params: {params().postId}
            </span>
          </>
        )
      }

      const postRoute = createRoute({
        getParentRoute: () => postsRoute,
        path: '$postId',
        component: PostComponent,
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([
          indexRoute,
          layoutRoute.addChildren([postsRoute.addChildren([postRoute])]),
        ]),
        trailingSlash: trailingSlash ? 'always' : 'never',
      })

      render(() => <RouterProvider router={router} />)

      const postsButton = await screen.findByTestId('posts-link')

      fireEvent.click(postsButton)

      await waitFor(() => {
        expect(window.location.pathname).toEqual(`/posts${tail}`)
      })

      const firstPostButton = await screen.findByTestId('first-post-link')

      fireEvent.click(firstPostButton)

      await waitFor(() => {
        expect(window.location.pathname).toEqual(`/posts/id1${tail}`)
      })

      const secondPostButton = await screen.findByTestId('second-post-link')

      fireEvent.click(secondPostButton)

      await waitFor(() => {
        expect(window.location.pathname).toEqual(`/posts/id2${tail}`)
      })
    },
  )
})

describe('relative links to from route', () => {
  test.each([true, false])(
    'should navigate to from route when using "." in nested route structure from Index Route with trailingSlash: %s',
    async (trailingSlash: boolean) => {
      const tail = trailingSlash ? '/' : ''

      const rootRoute = createRootRoute()

      const IndexComponent = () => {
        return (
          <>
            <Link data-testid="posts-link" to="/post">
              Post
            </Link>
            <Link
              data-testid="search-link"
              to="."
              search={{ param1: 'value1' }}
            >
              Search
            </Link>
            <Link data-testid="home-link" from="/" to=".">
              Go To Home
            </Link>
            <Outlet />
          </>
        )
      }

      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: IndexComponent,
        validateSearch: z.object({
          param1: z.string().optional(),
        }),
      })

      const postRoute = createRoute({
        getParentRoute: () => indexRoute,
        path: 'post',
        component: () => <div>Post</div>,
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute, postRoute]),
        history,
        trailingSlash: trailingSlash ? 'always' : 'never',
      })

      render(() => <RouterProvider router={router} />)

      const postButton = await screen.findByTestId('posts-link')

      fireEvent.click(postButton)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/post${tail}`)
      })

      const searchButton = await screen.findByTestId('search-link')

      fireEvent.click(searchButton)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/post${tail}`)
        expect(router.state.location.search).toEqual({ param1: 'value1' })
      })

      const homeBtn = await screen.findByTestId('home-link')

      fireEvent.click(homeBtn)

      await waitFor(() => {
        expect(router.state.location.pathname).toBe(`/`)
        expect(router.state.location.search).toEqual({})
      })
    },
  )

  test.each([true, false])(
    'should navigate to from route with path params when using "." in nested route structure with trailingSlash: %s',
    async (trailingSlash) => {
      const tail = trailingSlash ? '/' : ''
      const rootRoute = createRootRoute()

      const IndexComponent = () => {
        return (
          <>
            <h1 data-testid="index-heading">Index</h1>
            <Link data-testid="posts-link" to="/posts">
              Posts
            </Link>
          </>
        )
      }

      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: IndexComponent,
      })

      const layoutRoute = createRoute({
        getParentRoute: () => rootRoute,
        id: '_layout',
        component: () => {
          return (
            <>
              <h1>Layout</h1>
              <Outlet />
            </>
          )
        },
      })

      const PostsComponent = () => {
        return (
          <>
            <h1 data-testid="posts-index-heading">Posts</h1>
            <Link
              data-testid="first-post-link"
              to="$postId"
              params={{ postId: '1' }}
            >
              To first post
            </Link>
            <Link
              data-testid="second-post-link"
              to="$postId"
              params={{ postId: '2' }}
            >
              To second post
            </Link>
            <Link data-testid="to-posts-index-link" from="/posts" to=".">
              To posts list
            </Link>
            <Outlet />
          </>
        )
      }

      const PostDetailComponent = () => {
        return (
          <>
            <h1 data-testid="post-detail-index-heading">Post Detail</h1>
            <Link data-testid="post-info-link" to="info">
              To post info
            </Link>
            <Link data-testid="post-notes-link" to="notes">
              To post notes
            </Link>
            <Link
              data-testid="to-post-detail-index-link"
              from="/posts/$postId"
              to="."
            >
              To index detail options
            </Link>
            <Outlet />
          </>
        )
      }

      const PostInfoComponent = () => {
        return (
          <>
            <h1 data-testid="post-info-heading">Post Info</h1>
          </>
        )
      }

      const PostNotesComponent = () => {
        return (
          <>
            <h1 data-testid="post-notes-heading">Post Notes</h1>
          </>
        )
      }

      const postsRoute = createRoute({
        getParentRoute: () => layoutRoute,
        path: 'posts',
        component: PostsComponent,
      })

      const postDetailRoute = createRoute({
        getParentRoute: () => postsRoute,
        path: '$postId',
        component: PostDetailComponent,
      })

      const postInfoRoute = createRoute({
        getParentRoute: () => postDetailRoute,
        path: 'info',
        component: PostInfoComponent,
      })

      const postNotesRoute = createRoute({
        getParentRoute: () => postDetailRoute,
        path: 'notes',
        component: PostNotesComponent,
      })

      const router = createRouter({
        routeTree: rootRoute.addChildren([
          indexRoute,
          layoutRoute.addChildren([
            postsRoute.addChildren([
              postDetailRoute.addChildren([postInfoRoute, postNotesRoute]),
            ]),
          ]),
        ]),
        trailingSlash: trailingSlash ? 'always' : 'never',
      })

      render(() => <RouterProvider router={router} />)

      const postsButton = await screen.findByTestId('posts-link')

      fireEvent.click(postsButton)

      await waitFor(() => {
        expect(screen.queryByTestId('posts-index-heading')).toBeInTheDocument()
        expect(window.location.pathname).toEqual(`/posts${tail}`)
      })

      const firstPostButton = await screen.findByTestId('first-post-link')

      fireEvent.click(firstPostButton)

      await waitFor(() => {
        expect(
          screen.queryByTestId('post-detail-index-heading'),
        ).toBeInTheDocument()
        expect(window.location.pathname).toEqual(`/posts/1${tail}`)
      })

      const postInfoButton = await screen.findByTestId('post-info-link')

      fireEvent.click(postInfoButton)

      await waitFor(() => {
        expect(screen.queryByTestId('post-info-heading')).toBeInTheDocument()
        expect(window.location.pathname).toEqual(`/posts/1/info${tail}`)
      })

      const toPostDetailIndexButton = await screen.findByTestId(
        'to-post-detail-index-link',
      )

      fireEvent.click(toPostDetailIndexButton)

      await waitFor(() => {
        expect(
          screen.queryByTestId('post-detail-index-heading'),
        ).toBeInTheDocument()
        expect(
          screen.queryByTestId('post-info-heading'),
        ).not.toBeInTheDocument()
        expect(window.location.pathname).toEqual(`/posts/1${tail}`)
      })

      const postNotesButton = await screen.findByTestId('post-notes-link')

      fireEvent.click(postNotesButton)

      await waitFor(() => {
        expect(screen.queryByTestId('post-notes-heading')).toBeInTheDocument()
        expect(window.location.pathname).toEqual(`/posts/1/notes${tail}`)
      })

      const toPostsIndexButton = await screen.findByTestId(
        'to-posts-index-link',
      )

      fireEvent.click(toPostsIndexButton)

      await waitFor(() => {
        expect(screen.queryByTestId('posts-index-heading')).toBeInTheDocument()
        expect(
          screen.queryByTestId('post-notes-heading'),
        ).not.toBeInTheDocument()
        expect(
          screen.queryByTestId('post-detail-index-heading'),
        ).not.toBeInTheDocument()
        expect(window.location.pathname).toEqual(`/posts${tail}`)
      })

      const secondPostButton = await screen.findByTestId('second-post-link')

      fireEvent.click(secondPostButton)

      await waitFor(() => {
        expect(
          screen.queryByTestId('post-detail-index-heading'),
        ).toBeInTheDocument()
        expect(window.location.pathname).toEqual(`/posts/2${tail}`)
      })
    },
  )
})

describe('when on /posts/$postId and navigating to ../ with default `from` /posts', () => {
  async function runTest(navigateVia: 'Route' | 'RouteApi') {
    const rootRoute = createRootRoute()

    const IndexComponent = () => {
      return (
        <>
          <h1 data-testid="index-heading">Index</h1>
          <Link data-testid="posts-link" to="/posts">
            Posts
          </Link>
          <Link
            data-testid="index-to-first-post-link"
            to="/posts/$postId/details"
            params={{ postId: 'id1' }}
          >
            To first post
          </Link>
        </>
      )
    }

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: IndexComponent,
    })

    const layoutRoute = createRoute({
      getParentRoute: () => rootRoute,
      id: '_layout',
      component: () => {
        return (
          <>
            <h1>Layout</h1>
            <Outlet />
          </>
        )
      },
    })

    const PostsComponent = () => {
      const LinkViaRoute = () => (
        <Link from={postsRoute.fullPath} to="../" data-testid="link-to-home">
          To Home
        </Link>
      )

      const LinkViaRouteApi = () => {
        const RouteApiLink = postsRouteApi.Link
        return (
          <RouteApiLink to="../" data-testid="link-to-home">
            To Home
          </RouteApiLink>
        )
      }

      return (
        <>
          <h1>Posts</h1>
          {navigateVia === 'Route' ? <LinkViaRoute /> : <LinkViaRouteApi />}
          <Outlet />
        </>
      )
    }

    const postsRoute = createRoute({
      getParentRoute: () => layoutRoute,
      path: 'posts',
      component: PostsComponent,
    })

    const postsRouteApi = getRouteApi('/_layout/posts')

    const PostComponent = () => {
      const params = useParams({ strict: false })
      return (
        <>
          <span>Params: {params().postId}</span>
          <Outlet />
        </>
      )
    }

    const postRoute = createRoute({
      getParentRoute: () => postsRoute,
      path: '$postId',
      component: PostComponent,
    })

    const PostIndexComponent = () => {
      return (
        <>
          <h1>Post Index</h1>
        </>
      )
    }

    const postIndexRoute = createRoute({
      getParentRoute: () => postRoute,
      path: '/',
      component: PostIndexComponent,
    })

    const DetailsComponent = () => {
      return (
        <>
          <h1 data-testid="details-heading">Details!</h1>
        </>
      )
    }

    const detailsRoute = createRoute({
      getParentRoute: () => postRoute,
      path: 'details',
      component: DetailsComponent,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([
        indexRoute,
        layoutRoute.addChildren([
          postsRoute.addChildren([
            postRoute.addChildren([postIndexRoute, detailsRoute]),
          ]),
        ]),
      ]),
    })

    render(() => <RouterProvider router={router} />)

    const postsButton = await screen.findByTestId('index-to-first-post-link')

    fireEvent.click(postsButton)

    expect(await screen.findByTestId('details-heading')).toBeInTheDocument()

    expect(window.location.pathname).toEqual('/posts/id1/details')

    const homeButton = await screen.findByTestId('link-to-home')

    fireEvent.click(homeButton)

    expect(await screen.findByTestId('index-heading')).toBeInTheDocument()
    expect(window.location.pathname).toEqual('/')
  }

  test('Route', () => runTest('Route'))
  test('RouteApi', () => runTest('RouteApi'))
})

describe('rewrite', () => {
  test('renders hard link when rewrite points to different origin', async () => {
    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link data-testid="link-to-index" to="/">
              Index
            </Link>
            <Link data-testid="link-to-info" to="/info">
              Info
            </Link>
            <Link data-testid="link-to-app" to="/app">
              App
            </Link>
          </>
        )
      },
    })

    const infoRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/info',
      component: () => {
        return (
          <>
            <h1>Info</h1>
          </>
        )
      },
    })

    const appRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/app',
      component: () => {
        return (
          <>
            <h1>App</h1>
          </>
        )
      },
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, infoRoute, appRoute]),
      history,
      origin: 'http://example.com',
      rewrite: {
        input: ({ url }) => {
          if (url.href.startsWith('http://app.example.com')) {
            return url.href.replace('http://example.com/ap', '')
          }
          return undefined
        },
        output: ({ url }) => {
          if (url.pathname.startsWith('/app')) {
            ;((url.hostname = 'app.example.com'),
              (url.pathname = url.pathname.replace(/^\/app/, '')))
          }
          return url
        },
      },
    })

    render(() => <RouterProvider router={router} />)

    const infoLink = await screen.findByTestId('link-to-info')
    expect(infoLink).toHaveAttribute('href', '/info')

    const appLink = await screen.findByTestId('link-to-app')
    expect(appLink).toHaveAttribute('href', 'http://app.example.com/')
  })
})

describe('hash history with target="_blank" links', () => {
  test('should generate correct href for target="_blank" links in hash history mode', async () => {
    const hashHistory = createHashHistory()

    const rootRoute = createRootRoute()
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => {
        return (
          <>
            <h1>Index</h1>
            <Link data-testid="posts-link" to="/posts">
              Posts (same tab)
            </Link>
            <Link data-testid="about-blank-link" to="/about" target="_blank">
              About (new tab)
            </Link>
          </>
        )
      },
    })

    const postsRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      component: () => <h1>Posts</h1>,
    })

    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      component: () => <h1>About</h1>,
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute, postsRoute, aboutRoute]),
      history: hashHistory,
    })

    render(() => <RouterProvider router={router} />)

    const postsLink = await screen.findByTestId('posts-link')
    expect(postsLink).toHaveAttribute('href', '/#/posts')
    expect(postsLink).not.toHaveAttribute('target', '_blank')

    const postsBlankLink = await screen.findByTestId('about-blank-link')
    expect(postsBlankLink).toHaveAttribute('href', '/#/about')
    expect(postsBlankLink).toHaveAttribute('target', '_blank')
  })
})

describe('encoded and unicode paths', () => {
  const testCases = [
    {
      name: 'with prefix',
      path: '/foo/prefix@대{$}',
      expectedPath:
        '/foo/prefix@%EB%8C%80test[s%5C/.%5C/parameter%25!%F0%9F%9A%80%40]',
      expectedLocation: '/foo/prefix@대test[s%5C/.%5C/parameter%25!🚀%40]',
      params: {
        _splat: 'test[s\\/.\\/parameter%!🚀@]',
        '*': 'test[s\\/.\\/parameter%!🚀@]',
      },
    },
    {
      name: 'with suffix',
      path: '/foo/{$}대suffix@',
      expectedPath:
        '/foo/test[s%5C/.%5C/parameter%25!%F0%9F%9A%80%40]%EB%8C%80suffix@',
      expectedLocation: '/foo/test[s%5C/.%5C/parameter%25!🚀%40]대suffix@',
      params: {
        _splat: 'test[s\\/.\\/parameter%!🚀@]',
        '*': 'test[s\\/.\\/parameter%!🚀@]',
      },
    },
    {
      name: 'with wildcard',
      path: '/foo/$',
      expectedPath: '/foo/test[s%5C/.%5C/parameter%25!%F0%9F%9A%80]',
      expectedLocation: '/foo/test[s%5C/.%5C/parameter%25!🚀]',
      params: {
        _splat: 'test[s\\/.\\/parameter%!🚀]',
        '*': 'test[s\\/.\\/parameter%!🚀]',
      },
    },
    // '/' is left as is with splat params but encoded with normal params
    {
      name: 'with path param',
      path: `/foo/$id`,
      expectedPath: '/foo/test[s%5C%2F.%5C%2Fparameter%25!%F0%9F%9A%80]',
      expectedLocation: '/foo/test[s%5C%2F.%5C%2Fparameter%25!🚀]',
      params: {
        id: 'test[s\\/.\\/parameter%!🚀]',
      },
    },
  ]

  test.each(testCases)(
    'should handle encoded, decoded paths with unicode characters correctly - $name',
    async ({ path, expectedPath, expectedLocation, params }) => {
      const rootRoute = createRootRoute()

      const indexRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => {
          return (
            <>
              <h1>Index Route</h1>
              <Link data-testid="link-to-path" to={path} params={params}>
                Link to path
              </Link>
            </>
          )
        },
      })

      const pathRoute = createRoute({
        getParentRoute: () => rootRoute,
        path,
        component: PathRouteComponent,
      })

      function PathRouteComponent() {
        const params = pathRoute.useParams()
        return (
          <div>
            <h1>Path Route</h1>
            <p>
              params:{' '}
              <span data-testid="params-to-validate">
                {JSON.stringify(params())}
              </span>
            </p>
          </div>
        )
      }

      const router = createRouter({
        routeTree: rootRoute.addChildren([indexRoute, pathRoute]),
        history,
      })

      render(() => <RouterProvider router={router} />)

      const link = await screen.findByTestId('link-to-path')

      expect(link.getAttribute('href')).toBe(expectedPath)

      fireEvent.click(link)

      const paramsToValidate = await screen.findByTestId('params-to-validate')

      expect(window.location.pathname).toBe(expectedPath)
      expect(router.latestLocation.pathname).toBe(expectedLocation)

      expect(paramsToValidate.textContent).toEqual(JSON.stringify(params))
    },
  )
})
