import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/vue'
import { z } from 'zod'
import { composeRewrites, notFound } from '@tanstack/router-core'
import {
  Link,
  Outlet,
  RouterProvider,
  SearchParamError,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
} from '../src'
import { sleep } from './utils'
import type { StandardSchemaValidator } from '@tanstack/router-core'
import type {
  AnyRoute,
  AnyRouter,
  RouterOptions,
  ValidatorFn,
  ValidatorObj,
} from '../src'

afterEach(() => {
  vi.resetAllMocks()
  window.history.replaceState(null, 'root', '/')
  cleanup()
})

const mockFn1 = vi.fn()

export function validateSearchParams<
  TExpected extends Partial<Record<string, string>>,
>(expected: TExpected, router: AnyRouter) {
  const parsedSearch = new URLSearchParams(window.location.search)
  expect(parsedSearch.size).toBe(Object.keys(expected).length)
  for (const [key, value] of Object.entries(expected)) {
    expect(parsedSearch.get(key)).toBe(value)
  }
  expect(router.state.location.search).toEqual(expected)
}

function createTestRouter(
  options?: RouterOptions<AnyRoute, 'never', any, any, any>,
) {
  const rootRoute = createRootRoute({
    validateSearch: z.object({ root: z.string().optional() }),
    component: () => {
      const search = rootRoute.useSearch()
      return (
        <>
          <div data-testid="search-root">
            {search.value.root ?? '$undefined'}
          </div>
          <Outlet />
        </>
      )
    },
  })
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' })
  const usersRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/users',
  })
  const userRoute = createRoute({
    getParentRoute: () => usersRoute,
    path: '/$userId',
  })
  const userFilesRoute = createRoute({
    getParentRoute: () => userRoute,
    path: '/files/$fileId',
  })
  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts',
  })
  const postIdRoute = createRoute({
    getParentRoute: () => postsRoute,
    path: '/$slug',
  })
  const topLevelSplatRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '$',
  })
  // This is simulates a user creating a `é.tsx` file using file-based routing
  const pathSegmentEAccentRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/path-segment/é',
  })
  // This is simulates a user creating a `🚀.tsx` file using file-based routing
  const pathSegmentRocketEmojiRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/path-segment/🚀',
  })
  const pathSegmentSoloSplatRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/solo-splat/$',
  })
  const pathSegmentLayoutSplatRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/layout-splat',
  })
  const pathSegmentLayoutSplatIndexRoute = createRoute({
    getParentRoute: () => pathSegmentLayoutSplatRoute,
    path: '/',
  })
  const pathSegmentLayoutSplatSplatRoute = createRoute({
    getParentRoute: () => pathSegmentLayoutSplatRoute,
    path: '$',
  })
  const protectedRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: '/_protected',
  }).lazy(() => import('./lazy/normal').then((f) => f.Route('/_protected')))
  const protectedLayoutRoute = createRoute({
    getParentRoute: () => protectedRoute,
    id: '/_layout',
  }).lazy(() =>
    import('./lazy/normal').then((f) => f.Route('/_protected/_layout')),
  )
  const protectedFileBasedLayoutRoute = createRoute({
    getParentRoute: () => protectedRoute,
    id: '/_fileBasedLayout',
  }).lazy(() =>
    import('./lazy/normal').then((f) =>
      f.FileRoute('/_protected/_fileBasedLayout'),
    ),
  )
  const protectedFileBasedLayoutParentRoute = createRoute({
    getParentRoute: () => protectedFileBasedLayoutRoute,
    path: '/fileBasedParent',
  }).lazy(() =>
    import('./lazy/normal').then((f) =>
      f.FileRoute('/_protected/_fileBasedLayout/fileBasedParent'),
    ),
  )
  const protectedLayoutParentRoute = createRoute({
    getParentRoute: () => protectedLayoutRoute,
    path: '/parent',
  }).lazy(() =>
    import('./lazy/normal').then((f) => f.Route('/_protected/_layout/parent')),
  )
  const protectedLayoutParentChildRoute = createRoute({
    getParentRoute: () => protectedLayoutParentRoute,
    path: '/child',
  }).lazy(() =>
    import('./lazy/normal').then((f) =>
      f.Route('/_protected/_layout/parent/child'),
    ),
  )
  const protectedFileBasedLayoutParentChildRoute = createRoute({
    getParentRoute: () => protectedFileBasedLayoutParentRoute,
    path: '/child',
  }).lazy(() =>
    import('./lazy/normal').then((f) =>
      f.FileRoute('/_protected/_fileBasedLayout/fileBasedParent/child'),
    ),
  )
  const searchRoute = createRoute({
    validateSearch: z.object({ search: z.string().optional() }),
    getParentRoute: () => rootRoute,
    path: 'search',
    component: () => {
      const search = searchRoute.useSearch()
      return (
        <>
          <div data-testid="search-search">
            {search.value.search ?? '$undefined'}
          </div>
        </>
      )
    },
  })
  const searchWithDefaultRoute = createRoute({
    getParentRoute: () => rootRoute,

    path: 'searchWithDefault',
  })
  const searchWithDefaultIndexRoute = createRoute({
    getParentRoute: () => searchWithDefaultRoute,
    path: '/',
    component: () => {
      return (
        <>
          <Link
            data-testid="link-without-params"
            to="/searchWithDefault/check"
            search={{ default: 'd1' }}
          >
            without params
          </Link>
          <Link
            data-testid="link-with-optional-param"
            to="/searchWithDefault/check"
            search={{ optional: 'o1' }}
          >
            with optional param
          </Link>
          <Link
            data-testid="link-with-default-param"
            to="/searchWithDefault/check"
            search={{ default: 'd2' }}
          >
            with default param
          </Link>
          <Link
            data-testid="link-with-both-params"
            to="/searchWithDefault/check"
            search={{ optional: 'o1', default: 'd2' }}
          >
            with both params
          </Link>
        </>
      )
    },
  })

  const searchWithDefaultCheckRoute = createRoute({
    validateSearch: z.object({
      default: z.string().default('d1'),
      optional: z.string().optional(),
    }),
    getParentRoute: () => searchWithDefaultRoute,
    path: 'check',
    component: () => {
      const search = searchWithDefaultCheckRoute.useSearch()
      return (
        <>
          <div data-testid="search-default">{search.value.default}</div>
          <div data-testid="search-optional">
            {search.value.optional ?? '$undefined'}
          </div>
        </>
      )
    },
  })

  const nestedSearchRoute = createRoute({
    getParentRoute: () => rootRoute,
    validateSearch: z.object({ foo: z.string() }),
    path: 'nested-search',
  })

  const nestedSearchChildRoute = createRoute({
    getParentRoute: () => nestedSearchRoute,
    validateSearch: z.object({ bar: z.string() }),
    path: 'child',
  })

  const linksToItselfRoute = createRoute({
    validateSearch: z.object({ search: z.string().optional() }),
    getParentRoute: () => rootRoute,
    path: 'linksToItself',
    component: () => {
      return (
        <>
          <Link to="/linksToItself" data-testid="link">
            Click me
          </Link>
        </>
      )
    },
  })

  const routeTree = rootRoute.addChildren([
    indexRoute,
    usersRoute.addChildren([userRoute.addChildren([userFilesRoute])]),
    postsRoute.addChildren([postIdRoute]),
    pathSegmentEAccentRoute,
    pathSegmentRocketEmojiRoute,
    pathSegmentSoloSplatRoute,
    topLevelSplatRoute,
    pathSegmentLayoutSplatRoute.addChildren([
      pathSegmentLayoutSplatIndexRoute,
      pathSegmentLayoutSplatSplatRoute,
    ]),
    protectedRoute.addChildren([
      protectedLayoutRoute.addChildren([
        protectedLayoutParentRoute.addChildren([
          protectedLayoutParentChildRoute,
        ]),
      ]),
      protectedFileBasedLayoutRoute.addChildren([
        protectedFileBasedLayoutParentRoute.addChildren([
          protectedFileBasedLayoutParentChildRoute,
        ]),
      ]),
    ]),
    searchRoute,
    searchWithDefaultRoute.addChildren([
      searchWithDefaultIndexRoute,
      searchWithDefaultCheckRoute,
    ]),
    nestedSearchRoute.addChildren([nestedSearchChildRoute]),
    linksToItselfRoute,
  ])

  const router = createRouter({ routeTree, ...options })

  return {
    router,
    routes: {
      indexRoute,
      postsRoute,
      postIdRoute,
      topLevelSplatRoute,
      pathSegmentEAccentRoute,
      pathSegmentRocketEmojiRoute,
    },
  }
}

describe('encoding: URL param segment for /posts/$slug', () => {
  it('state.location.pathname, should have the params.slug value of "tanner"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/tanner'] }),
    })

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/tanner')
  })

  it('state.location.pathname, should have the params.slug value of "🚀"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/🚀'] }),
    })

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/🚀')
  })

  it('state.location.pathname, should have the params.slug value of "100%25"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/100%25'] }),
    })

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/100%25')
  })

  it('state.location.pathname, should have the params.slug value of "100%26"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/100%26'] }),
    })

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/100%26')
  })

  it('state.location.pathname, should have the params.slug value of "%F0%9F%9A%80"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/%F0%9F%9A%80'] }),
    })

    await router.load()

    expect(router.state.location.pathname).toBe('/posts/🚀')
  })

  it('state.location.pathname, should have the params.slug value of "framework%2Freact%2Fguide%2Ffile-based-routing%20tanstack"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({
        initialEntries: [
          '/posts/framework%2Freact%2Fguide%2Ffile-based-routing%20tanstack',
        ],
      }),
    })

    await router.load()

    expect(router.state.location.href).toBe(
      '/posts/framework%2Freact%2Fguide%2Ffile-based-routing%20tanstack',
    )

    expect(router.state.location.pathname).toBe(
      '/posts/framework%2Freact%2Fguide%2Ffile-based-routing tanstack',
    )
  })

  it('params.slug for the matched route, should be "tanner"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/tanner'] }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.postIdRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any).slug).toBe('tanner')
  })

  it('params.slug for the matched route, should be "🚀"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/🚀'] }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.postIdRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any).slug).toBe('🚀')
  })

  it('params.slug for the matched route, should be "🚀" instead of it being "%F0%9F%9A%80"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/%F0%9F%9A%80'] }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.postIdRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any).slug).toBe('🚀')
  })

  it('params.slug for the matched route, should be "100%"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/100%25'] }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.postIdRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any).slug).toBe('100%')
  })

  it('params.slug for the matched route, should be "100&"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/100%26'] }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.postIdRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any).slug).toBe('100&')
  })

  it('params.slug for the matched route, should be "100%100"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/100%25100'] }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.postIdRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any).slug).toBe('100%100')
  })

  it('params.slug for the matched route, should be "100&100"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/posts/100%26100'] }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.postIdRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any).slug).toBe('100&100')
  })

  it('params.slug for the matched route, should be "framework/react/guide/file-based-routing tanstack" instead of it being "framework%2Freact%2Fguide%2Ffile-based-routing%20tanstack"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({
        initialEntries: [
          '/posts/framework%2Freact%2Fguide%2Ffile-based-routing%20tanstack',
        ],
      }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.postIdRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any).slug).toBe(
      'framework/react/guide/file-based-routing tanstack',
    )
  })

  it('params.slug should be encoded in the final URL', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    await router.load()
    render(<RouterProvider router={router} />)

    await router.navigate({ to: '/posts/$slug', params: { slug: '@jane' } })

    expect(router.state.location.pathname).toBe('/posts/%40jane')
  })

  it('params.slug should be encoded in the final URL except characters in pathParamsAllowedCharacters', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
      pathParamsAllowedCharacters: ['@'],
    })

    await router.load()
    render(<RouterProvider router={router} />)

    await router.navigate({ to: '/posts/$slug', params: { slug: '@jane' } })

    expect(router.state.location.pathname).toBe('/posts/@jane')
  })
})

describe('encoding: URL splat segment for /$', () => {
  it('state.location.pathname, should have the params._splat value of "tanner"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/tanner'] }),
    })

    await router.load()

    expect(router.state.location.pathname).toBe('/tanner')
  })

  it('state.location.pathname, should have the params._splat value of "🚀"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/🚀'] }),
    })

    await router.load()

    expect(router.state.location.href).toBe('/%F0%9F%9A%80')
    expect(router.state.location.pathname).toBe('/🚀')
  })

  it('state.location.pathname, should have the params._splat value of "100%25"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/100%25'] }),
    })

    await router.load()

    expect(router.state.location.pathname).toBe('/100%25')
  })

  it('state.location.pathname, should have the params._splat value of "100%26"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/100%26'] }),
    })

    await router.load()

    expect(router.state.location.pathname).toBe('/100%26')
  })

  it('state.location.pathname, should have the params._splat value of "%F0%9F%9A%80"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/%F0%9F%9A%80'] }),
    })

    await router.load()

    expect(router.state.location.href).toBe('/%F0%9F%9A%80')
    expect(router.state.location.pathname).toBe('/🚀')
  })

  it('state.location.pathname, should have the params._splat value of "framework%2Freact%2Fguide%2Ffile-based-routing%20tanstack"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({
        initialEntries: [
          '/framework%2Freact%2Fguide%2Ffile-based-routing%20tanstack',
        ],
      }),
    })

    await router.load()

    expect(router.state.location.href).toBe(
      '/framework%2Freact%2Fguide%2Ffile-based-routing%20tanstack',
    )
    expect(router.state.location.pathname).toBe(
      '/framework%2Freact%2Fguide%2Ffile-based-routing tanstack',
    )
  })

  it('state.location.pathname, should have the params._splat value of "framework/react/guide/file-based-routing tanstack"', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({
        initialEntries: ['/framework/react/guide/file-based-routing tanstack'],
      }),
    })

    await router.load()

    expect(router.state.location.href).toBe(
      '/framework/react/guide/file-based-routing%20tanstack',
    )

    expect(router.state.location.pathname).toBe(
      '/framework/react/guide/file-based-routing tanstack',
    )
  })

  it('params._splat for the matched route, should be "tanner"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/tanner'] }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.topLevelSplatRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any)._splat).toBe('tanner')
  })

  it('params._splat for the matched route, should be "🚀"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/🚀'] }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.topLevelSplatRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any)._splat).toBe('🚀')
  })

  it('params._splat for the matched route, should be "🚀" instead of it being "%F0%9F%9A%80"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/%F0%9F%9A%80'] }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.topLevelSplatRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any)._splat).toBe('🚀')
  })

  it('params._splat for the matched route, should be "framework/react/guide/file-based-routing tanstack"', async () => {
    const { router, routes } = createTestRouter({
      history: createMemoryHistory({
        initialEntries: ['/framework/react/guide/file-based-routing tanstack'],
      }),
    })

    await router.load()

    const match = router.state.matches.find(
      (r) => r.routeId === routes.topLevelSplatRoute.id,
    )

    if (!match) {
      throw new Error('No match found')
    }

    expect((match.params as unknown as any)._splat).toBe(
      'framework/react/guide/file-based-routing tanstack',
    )
  })
})

describe('encoding: URL path segment', () => {
  it.each([
    {
      input: '/path-segment/%C3%A9',
      path: '/path-segment/é',
      url: '/path-segment/%C3%A9',
    },
    {
      input: '/path-segment/é',
      path: '/path-segment/é',
      url: '/path-segment/%C3%A9',
    },
    {
      input: '/path-segment/100%25', // `%25` = `%`
      path: '/path-segment/100%25',
      url: '/path-segment/100%25',
    },
    {
      input: '/path-segment/100%25%25',
      path: '/path-segment/100%25%25',
      url: '/path-segment/100%25%25',
    },
    {
      input: '/path-segment/100%26', // `%26` = `&`
      path: '/path-segment/100%26',
      url: '/path-segment/100%26',
    },
    {
      input: '/path-segment/%F0%9F%9A%80',
      path: '/path-segment/🚀',
      url: '/path-segment/%F0%9F%9A%80',
    },
    {
      input: '/path-segment/%F0%9F%9A%80to%2Fthe%2Fmoon',
      path: '/path-segment/🚀to%2Fthe%2Fmoon',
      url: '/path-segment/%F0%9F%9A%80to%2Fthe%2Fmoon',
    },
    {
      input: '/path-segment/%25%F0%9F%9A%80to%2Fthe%2Fmoon',
      path: '/path-segment/%25🚀to%2Fthe%2Fmoon',
      url: '/path-segment/%25%F0%9F%9A%80to%2Fthe%2Fmoon',
    },
    {
      input: '/path-segment/%F0%9F%9A%80to%2Fthe%2Fmoon%25',
      path: '/path-segment/🚀to%2Fthe%2Fmoon%25',
      url: '/path-segment/%F0%9F%9A%80to%2Fthe%2Fmoon%25',
    },
    {
      input:
        '/path-segment/%F0%9F%9A%80to%2Fthe%2Fmoon%25%F0%9F%9A%80to%2Fthe%2Fmoon',
      path: '/path-segment/🚀to%2Fthe%2Fmoon%25🚀to%2Fthe%2Fmoon',
      url: '/path-segment/%F0%9F%9A%80to%2Fthe%2Fmoon%25%F0%9F%9A%80to%2Fthe%2Fmoon',
    },
    {
      input: '/path-segment/🚀',
      path: '/path-segment/🚀',
      url: '/path-segment/%F0%9F%9A%80',
    },
    {
      input: '/path-segment/🚀to%2Fthe%2Fmoon',
      path: '/path-segment/🚀to%2Fthe%2Fmoon',
      url: '/path-segment/%F0%9F%9A%80to%2Fthe%2Fmoon',
    },
  ])('should resolve $input to $output', async ({ input, path, url }) => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: [input] }),
    })

    render(<RouterProvider router={router} />)
    await router.load()

    expect(router.state.location.pathname).toBe(path)
    expect(router.state.location.href).toBe(url)
  })
})

describe('router emits events during rendering', () => {
  it('during initial load, should emit the "onResolved" event', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    const unsub = router.subscribe('onResolved', mockFn1)
    await router.load()
    render(<RouterProvider router={router} />)

    await waitFor(() => expect(mockFn1).toBeCalled())
    unsub()
  })

  it('after a navigation, should have emitted the "onResolved" event twice', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    const unsub = router.subscribe('onResolved', mockFn1)
    await router.load()
    render(<RouterProvider router={router} />)
    await sleep(0)
    await router.navigate({ to: '/$', params: { _splat: 'tanner' } })

    await waitFor(() => expect(mockFn1).toBeCalledTimes(2))
    unsub()
  })

  it('should emit the "onRendered" event when a route renders, after navigation, and after param/search updates', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
      scrollRestoration: true,
    })

    const mockOnRendered = vi.fn()
    const unsub = router.subscribe('onRendered', mockOnRendered)
    await router.load()

    await waitFor(() => expect(mockOnRendered).toBeCalledTimes(0))
    render(<RouterProvider router={router} />)

    await waitFor(() => expect(mockOnRendered).toBeCalledTimes(1))
    expect(mockOnRendered.mock.calls[0]?.[0]?.toLocation.pathname).toBe('/')

    await router.navigate({ to: '/posts/$slug', params: { slug: 'first' } })

    await waitFor(() => expect(mockOnRendered).toBeCalledTimes(2))
    expect(mockOnRendered.mock.calls[1]?.[0]?.toLocation.pathname).toBe(
      '/posts/first',
    )

    await router.navigate({ to: '/posts/$slug', params: { slug: 'second' } })

    await waitFor(() => expect(mockOnRendered).toBeCalledTimes(3))
    expect(mockOnRendered.mock.calls[2]?.[0]?.toLocation.pathname).toBe(
      '/posts/second',
    )

    await router.navigate({
      to: '/posts/$slug',
      params: { slug: 'second' },
      search: { root: 'search-change' },
    })

    await waitFor(() => expect(mockOnRendered).toBeCalledTimes(4))
    expect(mockOnRendered.mock.calls[3]?.[0]?.toLocation.search.root).toBe(
      'search-change',
    )

    unsub()
  })

  it('during initial load, should emit the "onBeforeRouteMount" and "onResolved" events in the correct order', async () => {
    const mockOnBeforeRouteMount = vi.fn()
    const mockOnResolved = vi.fn()

    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    // Subscribe to the events
    const unsubBeforeRouteMount = router.subscribe(
      'onBeforeRouteMount',
      mockOnBeforeRouteMount,
    )
    const unsubResolved = router.subscribe('onResolved', mockOnResolved)

    await router.load()
    render(<RouterProvider router={router} />)

    // Ensure the "onBeforeRouteMount" event was called once
    await waitFor(() => expect(mockOnBeforeRouteMount).toBeCalledTimes(1))

    // Ensure the "onResolved" event was also called once
    await waitFor(() => expect(mockOnResolved).toBeCalledTimes(1))

    // Check if the invocation call orders are defined before comparing
    const beforeRouteMountOrder =
      mockOnBeforeRouteMount.mock.invocationCallOrder[0]
    const onResolvedOrder = mockOnResolved.mock.invocationCallOrder[0]

    if (beforeRouteMountOrder !== undefined && onResolvedOrder !== undefined) {
      expect(beforeRouteMountOrder).toBeLessThan(onResolvedOrder)
    } else {
      throw new Error('onBeforeRouteMount should be emitted before onResolved.')
    }

    unsubBeforeRouteMount()
    unsubResolved()
  })
})

describe('router matches URLs to route definitions', () => {
  it('solo splat route matches index route', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/solo-splat'] }),
    })

    await router.load()

    expect(router.state.matches.map((d) => d.routeId)).toEqual([
      '__root__',
      '/solo-splat/$',
    ])
  })

  it('solo splat route matches with splat', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/solo-splat/test'] }),
    })

    await router.load()

    expect(router.state.matches.map((d) => d.routeId)).toEqual([
      '__root__',
      '/solo-splat/$',
    ])
  })

  it('layout splat route matches with splat', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/layout-splat/test'] }),
    })

    await router.load()

    expect(router.state.matches.map((d) => d.routeId)).toEqual([
      '__root__',
      '/layout-splat',
      '/layout-splat/$',
    ])
  })

  it('nested path params', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({
        initialEntries: ['/users/5678/files/123'],
      }),
    })

    await router.load()

    expect(router.state.matches.map((d) => d.routeId)).toEqual([
      '__root__',
      '/users',
      '/users/$userId',
      '/users/$userId/files/$fileId',
    ])
  })
})

describe('matches', () => {
  describe('params', () => {
    it('/users/$userId/files/$fileId', async () => {
      const { router } = createTestRouter({
        history: createMemoryHistory({
          initialEntries: ['/users/5678/files/123'],
        }),
      })

      await router.load()

      const expectedStrictParams: Record<string, unknown> = {
        __root__: {},
        '/users': {},
        '/users/$userId': { userId: '5678' },
        '/users/$userId/files/$fileId': { userId: '5678', fileId: '123' },
      }

      expect(router.state.matches.length).toEqual(
        Object.entries(expectedStrictParams).length,
      )
      router.state.matches.forEach((match) => {
        expect(match.params).toEqual(
          expectedStrictParams['/users/$userId/files/$fileId'],
        )
      })
      router.state.matches.forEach((match) => {
        expect(match._strictParams).toEqual(expectedStrictParams[match.routeId])
      })
    })
  })

  describe('search', () => {
    it('/nested-search/child?foo=hello&bar=world', async () => {
      const { router } = createTestRouter({
        history: createMemoryHistory({
          initialEntries: ['/nested-search/child?foo=hello&bar=world'],
        }),
      })

      await router.load()

      const expectedStrictSearch: Record<string, unknown> = {
        __root__: {},
        '/nested-search': { foo: 'hello' },
        '/nested-search/child': { foo: 'hello', bar: 'world' },
      }

      expect(router.state.matches.length).toEqual(
        Object.entries(expectedStrictSearch).length,
      )
      router.state.matches.forEach((match) => {
        expect(match.search).toEqual(
          expectedStrictSearch['/nested-search/child'],
        )
      })
      router.state.matches.forEach((match) => {
        expect(match._strictSearch).toEqual(expectedStrictSearch[match.routeId])
      })
    })
  })
})

describe('invalidate', () => {
  it('after router.invalid(), routes should be `valid` again after loading', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    await router.load()

    router.state.matches.forEach((match) => {
      expect(match.invalid).toBe(false)
    })

    await router.invalidate()

    router.state.matches.forEach((match) => {
      expect(match.invalid).toBe(false)
    })
  })

  it('re-runs loaders that throw notFound() when invalidated via HMR filter', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/hmr-not-found'],
    })
    const loader = vi.fn(() => {
      throw notFound()
    })

    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const hmrRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/hmr-not-found',
      loader,
      component: () => <div data-testid="hmr-route">Route</div>,
      notFoundComponent: () => (
        <div data-testid="hmr-route-not-found">Route Not Found</div>
      ),
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([hmrRoute]),
      history,
    })

    render(<RouterProvider router={router} />)
    await router.load()

    await screen.findByTestId('hmr-route-not-found')
    const initialCalls = loader.mock.calls.length
    expect(initialCalls).toBeGreaterThan(0)

    await router.invalidate({
      filter: (match) => match.routeId === hmrRoute.id,
    })

    await waitFor(() => expect(loader).toHaveBeenCalledTimes(initialCalls + 1))
    await screen.findByTestId('hmr-route-not-found')
    expect(screen.queryByTestId('hmr-route')).not.toBeInTheDocument()
  })

  it('keeps rendering a route notFoundComponent when loader returns notFound() after invalidate', async () => {
    const history = createMemoryHistory({
      initialEntries: ['/loader-not-found'],
    })
    const loader = vi.fn(() => notFound())

    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const loaderRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/loader-not-found',
      loader,
      component: () => <div data-testid="loader-route">Route</div>,
      notFoundComponent: () => (
        <div data-testid="loader-not-found-component">Route Not Found</div>
      ),
    })

    const router = createRouter({
      routeTree: rootRoute.addChildren([loaderRoute]),
      history,
    })

    render(<RouterProvider router={router} />)
    await router.load()

    await screen.findByTestId('loader-not-found-component')
    const initialCalls = loader.mock.calls.length
    expect(initialCalls).toBeGreaterThan(0)

    await router.invalidate()

    await waitFor(() => expect(loader).toHaveBeenCalledTimes(initialCalls + 1))
    await screen.findByTestId('loader-not-found-component')
    expect(screen.queryByTestId('loader-route')).not.toBeInTheDocument()
  })
})

describe('search params in URL', () => {
  const testCases = [
    { route: '/', search: { root: 'world' } },
    { route: '/', search: { root: 'world', unknown: 'asdf' } },
    { route: '/search', search: { search: 'foo' } },
    { route: '/search', search: { root: 'world', search: 'foo' } },
    {
      route: '/search',
      search: { root: 'world', search: 'foo', unknown: 'asdf' },
    },
  ]
  describe.each([undefined, false])(
    'does not modify the search params in the URL when search.strict=%s',
    (strict) => {
      it.each(testCases)(
        'at $route with search params $search',
        async ({ route, search }) => {
          const { router } = createTestRouter({ search: { strict } })
          window.history.replaceState(
            null,
            '',
            `${route}?${new URLSearchParams(search as Record<string, string>).toString()}`,
          )

          render(<RouterProvider router={router} />)
          await router.load()

          expect(await screen.findByTestId('search-root')).toHaveTextContent(
            search.root ?? '$undefined',
          )
          if (route === '/search') {
            expect(
              await screen.findByTestId('search-search'),
            ).toHaveTextContent(search.search ?? '$undefined')
          }
          validateSearchParams(search, router)
        },
      )
    },
  )

  describe('removes unknown search params in the URL when search.strict=true', () => {
    it.each(testCases)('%j', async ({ route, search }) => {
      const { router } = createTestRouter({ search: { strict: true } })
      window.history.replaceState(
        null,
        '',
        `${route}?${new URLSearchParams(search as Record<string, string>).toString()}`,
      )
      render(<RouterProvider router={router} />)
      await router.load()
      await expect(await screen.findByTestId('search-root')).toHaveTextContent(
        search.root ?? 'undefined',
      )
      if (route === '/search') {
        expect(await screen.findByTestId('search-search')).toHaveTextContent(
          search.search ?? 'undefined',
        )
      }

      expect(window.location.pathname).toEqual(route)
      const { unknown: _, ...expectedSearch } = { ...search }
      validateSearchParams(expectedSearch, router)
    })
  })

  describe.each([false, true, undefined])('default search params', (strict) => {
    let router: AnyRouter
    beforeEach(() => {
      const result = createTestRouter({ search: { strict } })
      router = result.router
    })

    async function checkSearch(expectedSearch: {
      default: string
      optional?: string
    }) {
      expect(await screen.findByTestId('search-default')).toHaveTextContent(
        expectedSearch.default,
      )
      expect(await screen.findByTestId('search-optional')).toHaveTextContent(
        expectedSearch.optional ?? '$undefined',
      )

      validateSearchParams(expectedSearch, router)
    }

    it('should add the default search param upon initial load when no search params are present', async () => {
      window.history.replaceState(null, '', `/searchWithDefault/check`)

      render(<RouterProvider router={router} />)
      await router.load()

      await checkSearch({ default: 'd1' })
    })

    it('should have the correct `default` search param upon initial load when the `default` param is present', async () => {
      window.history.replaceState(
        null,
        '',
        `/searchWithDefault/check?default=d2`,
      )

      render(<RouterProvider router={router} />)
      await router.load()

      await checkSearch({ default: 'd2' })
    })

    it('should add the default search param upon initial load when only the optional search param is present', async () => {
      window.history.replaceState(
        null,
        '',
        `/searchWithDefault/check?optional=o1`,
      )

      render(<RouterProvider router={router} />)
      await router.load()

      await checkSearch({ default: 'd1', optional: 'o1' })
    })

    it('should keep the search param upon initial load when both search params are present', async () => {
      window.history.replaceState(
        null,
        '',
        `/searchWithDefault/check?default=d2&optional=o1`,
      )

      render(<RouterProvider router={router} />)
      await router.load()

      await checkSearch({ default: 'd2', optional: 'o1' })
    })

    it('should have the default search param when navigating without search params', async () => {
      window.history.replaceState(null, '', `/searchWithDefault`)

      render(<RouterProvider router={router} />)
      await router.load()
      const link = await screen.findByTestId('link-without-params')

      expect(link).toBeInTheDocument()
      fireEvent.click(link)

      await checkSearch({ default: 'd1' })
    })

    it('should have the default search param when navigating with the optional search param', async () => {
      window.history.replaceState(null, '', `/searchWithDefault`)

      render(<RouterProvider router={router} />)
      await router.load()
      const link = await screen.findByTestId('link-with-optional-param')

      expect(link).toBeInTheDocument()
      fireEvent.click(link)

      await checkSearch({ default: 'd1', optional: 'o1' })
    })

    it('should have the correct `default` search param when navigating with the `default` search param', async () => {
      window.history.replaceState(null, '', `/searchWithDefault`)

      render(<RouterProvider router={router} />)
      await router.load()
      const link = await screen.findByTestId('link-with-default-param')

      expect(link).toBeInTheDocument()
      fireEvent.click(link)

      await checkSearch({ default: 'd2' })
    })

    it('should have the correct search params when navigating with both search params', async () => {
      window.history.replaceState(null, '', `/searchWithDefault`)

      render(<RouterProvider router={router} />)
      await router.load()
      const link = await screen.findByTestId('link-with-both-params')

      expect(link).toBeInTheDocument()
      fireEvent.click(link)

      await checkSearch({ default: 'd2', optional: 'o1' })
    })
  })

  describe('validates search params', () => {
    class TestValidationError extends Error {
      issues: Array<{ message: string }>
      constructor(issues: Array<{ message: string }>) {
        super('validation failed')
        this.name = 'TestValidationError'
        this.issues = issues
      }
    }
    const testCases: [
      StandardSchemaValidator<Record<string, unknown>, { search: string }>,
      ValidatorFn<Record<string, unknown>, { search: string }>,
      ValidatorObj<Record<string, unknown>, { search: string }>,
    ] = [
      {
        ['~standard']: {
          validate: (input) => {
            const result = z.object({ search: z.string() }).safeParse(input)
            if (result.success) {
              return { value: result.data }
            }
            return new TestValidationError(result.error.issues)
          },
        },
      },
      ({ search }) => {
        if (typeof search !== 'string') {
          throw new TestValidationError([
            { message: 'search must be a string' },
          ])
        }
        return { search }
      },
      {
        parse: ({ search }) => {
          if (typeof search !== 'string') {
            throw new TestValidationError([
              { message: 'search must be a string' },
            ])
          }
          return { search }
        },
      },
    ]

    describe.each(testCases)('search param validation', (validateSearch) => {
      it('does not throw an error when the search param is valid', async () => {
        let errorSpy: Error | undefined
        const rootRoute = createRootRoute({
          validateSearch,
          errorComponent: ({ error }) => {
            errorSpy = error
            return <></>
          },
        })

        const history = createMemoryHistory({
          initialEntries: ['/search?search=foo'],
        })
        const router = createRouter({ routeTree: rootRoute, history })
        render(<RouterProvider router={router} />)
        await router.load()

        expect(errorSpy).toBeUndefined()
      })

      it('throws an error when the search param is not valid', async () => {
        let errorSpy: Error | undefined
        const rootRoute = createRootRoute({
          validateSearch,
          errorComponent: ({ error }) => {
            errorSpy = error
            return <></>
          },
        })

        const history = createMemoryHistory({ initialEntries: ['/search'] })
        const router = createRouter({ routeTree: rootRoute, history })
        render(<RouterProvider router={router} />)
        await router.load()

        expect(errorSpy).toBeInstanceOf(SearchParamError)
        expect(errorSpy?.cause).toBeInstanceOf(TestValidationError)
      })
    })
  })
})

describe('route ids should be consistent after rebuilding the route tree', () => {
  it('should have the same route ids after rebuilding the route tree', async () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    const originalRouteIds = Object.keys(router.routesById)

    await router.navigate({
      to: '/parent/child',
    })

    await router.navigate({
      to: '/filBasedParent/child',
    })

    router.buildRouteTree()

    const rebuiltRouteIds = Object.keys(router.routesById)

    originalRouteIds.forEach((id) => {
      expect(rebuiltRouteIds).toContain(id)
    })

    rebuiltRouteIds.forEach((id) => {
      expect(originalRouteIds).toContain(id)
    })
  })
})

describe('route id uniqueness', () => {
  it('routesById should not have routes duplicated route ids', () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    const routeIdSet = new Set<string>()

    Object.values(router.routesById).forEach((route) => {
      expect(routeIdSet.has(route.id)).toBe(false)
      routeIdSet.add(route.id)
    })
  })

  it('routesByPath should not have routes duplicated route ids', () => {
    const { router } = createTestRouter({
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    const routeIdSet = new Set<string>()

    Object.values(router.routesByPath).forEach((route) => {
      expect(routeIdSet.has(route.id)).toBe(false)
      routeIdSet.add(route.id)
    })
  })
})

const createHistoryRouter = () => {
  const rootRoute = createRootRoute()

  const IndexComponent = () => {
    const navigate = useNavigate()

    return (
      <>
        <h1>Index</h1>
        <button onClick={() => navigate({ to: '/' })}>Index</button>
        <button onClick={() => navigate({ to: '/posts' })}>Posts</button>
        <button onClick={() => navigate({ to: '/posts', replace: true })}>
          Replace
        </button>
      </>
    )
  }

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: IndexComponent,
  })

  const postsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/posts',
    component: function Component() {
      const navigate = useNavigate()

      return (
        <>
          <h1>Posts</h1>
          <button onClick={() => navigate({ to: '/' })}>Index</button>
        </>
      )
    },
  })

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, postsRoute]),
  })

  return { router }
}

describe('history: History gives correct notifcations and state', () => {
  it('should work with push and back', async () => {
    const { router: router } = createHistoryRouter()

    type Router = typeof router

    const results: Array<
      Parameters<Parameters<Router['history']['subscribe']>[0]>[0]['action']
    > = []

    render(<RouterProvider router={router} />)

    const unsub = router.history.subscribe(({ action }) => {
      results.push(action)
    })

    const postsButton = await screen.findByRole('button', { name: 'Posts' })

    fireEvent.click(postsButton)

    expect(
      await screen.findByRole('heading', { name: 'Posts' }),
    ).toBeInTheDocument()

    expect(window.location.pathname).toBe('/posts')

    router.history.back()

    expect(
      await screen.findByRole('heading', { name: 'Index' }),
    ).toBeInTheDocument()

    expect(window.location.pathname).toBe('/')

    expect(results).toEqual([{ type: 'PUSH' }, { type: 'BACK' }])

    unsub()
  })

  it('should work more complex scenario', async () => {
    const { router: router } = createHistoryRouter()

    type Router = typeof router

    const results: Array<
      Parameters<Parameters<Router['history']['subscribe']>[0]>[0]['action']
    > = []

    render(<RouterProvider router={router} />)

    const unsub = router.history.subscribe(({ action }) => {
      results.push(action)
    })

    const replaceButton = await screen.findByRole('button', { name: 'Replace' })

    fireEvent.click(replaceButton)

    expect(
      await screen.findByRole('heading', { name: 'Posts' }),
    ).toBeInTheDocument()

    expect(window.location.pathname).toBe('/posts')

    const indexButton = await screen.findByRole('button', { name: 'Index' })

    fireEvent.click(indexButton)

    expect(
      await screen.findByRole('heading', { name: 'Index' }),
    ).toBeInTheDocument()

    expect(window.location.pathname).toBe('/')

    const postsButton = await screen.findByRole('button', { name: 'Posts' })

    fireEvent.click(postsButton)

    expect(
      await screen.findByRole('heading', { name: 'Posts' }),
    ).toBeInTheDocument()

    expect(window.location.pathname).toBe('/posts')

    router.history.back()

    expect(
      await screen.findByRole('heading', { name: 'Index' }),
    ).toBeInTheDocument()

    expect(window.location.pathname).toBe('/')

    router.history.go(1)

    expect(
      await screen.findByRole('heading', { name: 'Posts' }),
    ).toBeInTheDocument()

    expect(window.location.pathname).toBe('/posts')

    expect(results).toEqual([
      { type: 'REPLACE' },
      { type: 'PUSH' },
      { type: 'PUSH' },
      { type: 'BACK' },
      { type: 'GO', index: 1 },
    ])

    unsub()
  })
})

it('does not push to history if url and state are the same', async () => {
  const history = createMemoryHistory({ initialEntries: ['/linksToItself'] })
  const { router } = createTestRouter({
    history,
  })
  render(<RouterProvider router={router} />)
  const link = await screen.findByTestId('link')
  fireEvent.click(link)
  expect(history.length).toBe(1)
})

describe('does not strip search params if search validation fails', () => {
  afterEach(() => {
    window.history.replaceState(null, 'root', '/')
    cleanup()
  })

  function getRouter() {
    const rootRoute = createRootRoute({
      validateSearch: z.object({ root: z.string() }),
      component: () => {
        const search = rootRoute.useSearch()
        return (
          <div>
            <div data-testid="search-root">
              {search.value.root ?? '$undefined'}
            </div>
            <Outlet />
          </div>
        )
      },
    })
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      validateSearch: z.object({ index: z.string() }),
      component: () => {
        const search = rootRoute.useSearch()
        return (
          <>
            <div data-testid="search-index">
              {search.value.index ?? '$undefined'}
            </div>
            <Outlet />
          </>
        )
      },
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createRouter({ routeTree })

    return router
  }

  it('smoke test - all required search params are present', async () => {
    window.history.replaceState(null, 'root', '/?root=hello&index=world')
    const router = getRouter()
    render(<RouterProvider router={router} />)

    expect(await screen.findByTestId('search-root')).toHaveTextContent('hello')
    expect(await screen.findByTestId('search-index')).toHaveTextContent('world')

    expect(window.location.search).toBe('?root=hello&index=world')
  })

  it('root is missing', () => {
    window.history.replaceState(null, 'root', '/?index=world')
    const router = getRouter()
    render(<RouterProvider router={router} />)

    expect(window.location.search).toBe('?index=world')
  })

  it('index is missing', () => {
    window.history.replaceState(null, 'root', '/?root=hello')
    const router = getRouter()

    render(<RouterProvider router={router} />)

    expect(window.location.search).toBe('?root=hello')
  })
})

describe('statusCode reset on navigation', () => {
  it('should reset statusCode to 200 when navigating from 404 to valid route', async () => {
    const history = createMemoryHistory({ initialEntries: ['/'] })

    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <div>Home</div>,
    })

    const validRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/valid',
      component: () => <div>Valid Route</div>,
    })

    const routeTree = rootRoute.addChildren([indexRoute, validRoute])
    const router = createRouter({ routeTree, history })

    render(<RouterProvider router={router} />)

    expect(router.state.statusCode).toBe(200)

    await router.navigate({ to: '/' })
    await waitFor(() => expect(router.state.statusCode).toBe(200))

    await router.navigate({ to: '/non-existing' })
    await waitFor(() => expect(router.state.statusCode).toBe(404))

    await router.navigate({ to: '/valid' })
    await waitFor(() => expect(router.state.statusCode).toBe(200))

    await router.navigate({ to: '/another-non-existing' })
    await waitFor(() => expect(router.state.statusCode).toBe(404))
  })

  describe.each([true, false])(
    'status code is set when loader/beforeLoad throws (isAsync=%s)',
    (isAsync) => {
      const throwingFun = isAsync
        ? (toThrow: () => void) => async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            toThrow()
          }
        : (toThrow: () => void) => toThrow

      const throwNotFound = throwingFun(() => {
        throw notFound()
      })
      const throwError = throwingFun(() => {
        throw new Error('test-error')
      })
      it('should set statusCode to 404 when a route loader throws a notFound()', async () => {
        const history = createMemoryHistory({ initialEntries: ['/'] })

        const rootRoute = createRootRoute()

        const indexRoute = createRoute({
          getParentRoute: () => rootRoute,
          path: '/',
          component: () => <div>Home</div>,
        })

        const loaderThrowsRoute = createRoute({
          getParentRoute: () => rootRoute,
          path: '/loader-throws-not-found',
          loader: throwNotFound,
          component: () => (
            <div data-testid="route-component">loader will throw</div>
          ),
          notFoundComponent: () => (
            <div data-testid="not-found-component">Not Found</div>
          ),
        })

        const routeTree = rootRoute.addChildren([indexRoute, loaderThrowsRoute])
        const router = createRouter({ routeTree, history })

        render(<RouterProvider router={router} />)

        expect(router.state.statusCode).toBe(200)

        await router.navigate({ to: '/loader-throws-not-found' })
        await waitFor(() => expect(router.state.statusCode).toBe(404))
        expect(
          await screen.findByTestId('not-found-component'),
        ).toBeInTheDocument()
        expect(screen.queryByTestId('route-component')).not.toBeInTheDocument()
      })

      it('should set statusCode to 404 when a route beforeLoad throws a notFound()', async () => {
        const history = createMemoryHistory({ initialEntries: ['/'] })

        const rootRoute = createRootRoute({
          notFoundComponent: () => (
            <div data-testid="not-found-component">Not Found</div>
          ),
        })

        const indexRoute = createRoute({
          getParentRoute: () => rootRoute,
          path: '/',
          component: () => <div>Home</div>,
        })

        const beforeLoadThrowsRoute = createRoute({
          getParentRoute: () => rootRoute,
          path: '/beforeload-throws-not-found',
          beforeLoad: throwNotFound,
          component: () => (
            <div data-testid="route-component">beforeLoad will throw</div>
          ),
          notFoundComponent: () => (
            <div data-testid="not-found-component">Not Found</div>
          ),
        })

        const routeTree = rootRoute.addChildren([
          indexRoute,
          beforeLoadThrowsRoute,
        ])
        const router = createRouter({ routeTree, history })

        render(<RouterProvider router={router} />)

        expect(router.state.statusCode).toBe(200)

        await router.navigate({ to: '/beforeload-throws-not-found' })
        await waitFor(() => expect(router.state.statusCode).toBe(404))
        expect(
          await screen.findByTestId('not-found-component'),
        ).toBeInTheDocument()
        expect(screen.queryByTestId('route-component')).not.toBeInTheDocument()
      })

      it('should set statusCode to 500 when a route loader throws an Error', async () => {
        const history = createMemoryHistory({ initialEntries: ['/'] })

        const rootRoute = createRootRoute()

        const indexRoute = createRoute({
          getParentRoute: () => rootRoute,
          path: '/',
          component: () => <div>Home</div>,
        })

        const loaderThrowsRoute = createRoute({
          getParentRoute: () => rootRoute,
          path: '/loader-throws-error',
          loader: throwError,
          component: () => (
            <div data-testid="route-component">loader will throw</div>
          ),
          errorComponent: () => <div data-testid="error-component">Error</div>,
        })

        const routeTree = rootRoute.addChildren([indexRoute, loaderThrowsRoute])
        const router = createRouter({ routeTree, history })

        render(<RouterProvider router={router} />)

        expect(router.state.statusCode).toBe(200)

        await router.navigate({ to: '/loader-throws-error' })
        await waitFor(() => expect(router.state.statusCode).toBe(500))
        expect(await screen.findByTestId('error-component')).toBeInTheDocument()
        expect(screen.queryByTestId('route-component')).not.toBeInTheDocument()
      })

      it('should set statusCode to 500 when a route beforeLoad throws an Error', async () => {
        const history = createMemoryHistory({ initialEntries: ['/'] })

        const rootRoute = createRootRoute()

        const indexRoute = createRoute({
          getParentRoute: () => rootRoute,
          path: '/',
          component: () => <div>Home</div>,
        })

        const beforeLoadThrowsRoute = createRoute({
          getParentRoute: () => rootRoute,
          path: '/beforeload-throws-error',
          beforeLoad: throwError,
          component: () => (
            <div data-testid="route-component">beforeLoad will throw</div>
          ),
          errorComponent: () => <div data-testid="error-component">Error</div>,
        })

        const routeTree = rootRoute.addChildren([
          indexRoute,
          beforeLoadThrowsRoute,
        ])
        const router = createRouter({ routeTree, history })

        render(<RouterProvider router={router} />)

        expect(router.state.statusCode).toBe(200)

        await router.navigate({ to: '/beforeload-throws-error' })
        await waitFor(() => expect(router.state.statusCode).toBe(500))
        expect(await screen.findByTestId('error-component')).toBeInTheDocument()
        expect(screen.queryByTestId('route-component')).not.toBeInTheDocument()
      })
    },
  )
})

describe('basepath', () => {
  it('should handle basic basepath rewriting with input', async () => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const homeRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <div data-testid="home">Home</div>,
    })

    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      component: () => <div data-testid="about">About</div>,
    })

    const routeTree = rootRoute.addChildren([homeRoute, aboutRoute])

    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/my-app/about'],
      }),
      basepath: 'my-app',
    })

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByTestId('about')).toBeInTheDocument()
    })

    // Router should interpret the URL without the basepath
    expect(router.state.location.pathname).toBe('/about')
  })

  it.each([
    {
      description: 'basepath with leading and trailing slashes',
      basepath: '/api/v1/',
    },
    {
      description: 'basepath with leading slash but without trailing slash',
      basepath: '/api/v1',
    },
    {
      description: 'basepath without leading slash but with trailing slash',
      basepath: 'api/v1/',
    },
    {
      description: 'basepath without leading and trailing slashes',
      basepath: 'api/v1',
    },
  ])('should handle $description', async ({ basepath }) => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const usersRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/users',
      component: () => <div data-testid="users">Users</div>,
    })

    const routeTree = rootRoute.addChildren([usersRoute])

    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/api/v1/users'],
      }),
      basepath,
    })

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByTestId('users')).toBeInTheDocument()
    })

    expect(router.state.location.pathname).toBe('/users')
  })

  it.each([
    { description: 'has trailing slash', basepath: '/my-app/' },
    { description: 'has no trailing slash', basepath: '/my-app' },
  ])(
    'should not resolve to 404 when basepath $description and URL matches',
    async ({ basepath }) => {
      const rootRoute = createRootRoute({
        component: () => <Outlet />,
      })

      const homeRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => <div data-testid="home">Home</div>,
      })

      const usersRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/users',
        component: () => <div data-testid="users">Users</div>,
      })

      const routeTree = rootRoute.addChildren([homeRoute, usersRoute])

      const router = createRouter({
        routeTree,
        history: createMemoryHistory({
          initialEntries: ['/my-app/'],
        }),
        basepath,
      })

      render(<RouterProvider router={router} />)

      await waitFor(() => {
        expect(screen.getByTestId('home')).toBeInTheDocument()
      })

      expect(router.state.location.pathname).toBe('/')
      expect(router.state.statusCode).toBe(200)
    },
  )

  it.each([
    { description: 'with trailing slash', basepath: '/my-app/' },
    { description: 'without trailing slash', basepath: '/my-app' },
  ])(
    'should handle basepath $description when navigating to root path',
    async ({ basepath }) => {
      const rootRoute = createRootRoute({
        component: () => <Outlet />,
      })

      const homeRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/',
        component: () => (
          <div>
            <Link to="/about" data-testid="about-link">
              About
            </Link>
          </div>
        ),
      })

      const aboutRoute = createRoute({
        getParentRoute: () => rootRoute,
        path: '/about',
        component: () => <div data-testid="about">About</div>,
      })

      const routeTree = rootRoute.addChildren([homeRoute, aboutRoute])

      const history = createMemoryHistory({ initialEntries: ['/my-app/'] })

      const router = createRouter({
        routeTree,
        history,
        basepath,
      })

      render(<RouterProvider router={router} />)

      const aboutLink = await screen.findByTestId('about-link')
      fireEvent.click(aboutLink)

      await waitFor(() => {
        expect(screen.getByTestId('about')).toBeInTheDocument()
      })

      expect(router.state.location.pathname).toBe('/about')
      expect(history.location.pathname).toBe('/my-app/about')
    },
  )

  it('should handle empty basepath gracefully', async () => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const testRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/test',
      component: () => <div data-testid="test">Test</div>,
    })

    const routeTree = rootRoute.addChildren([testRoute])

    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/test'],
      }),
      basepath: '',
    })

    render(<RouterProvider router={router} />)

    expect(await screen.findByTestId('test')).toBeInTheDocument()

    expect(router.state.location.pathname).toBe('/test')
  })

  it('should combine basepath with additional input rewrite logic', async () => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const newApiRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/api/v2',
      component: () => <div data-testid="api-v2">API v2</div>,
    })

    const routeTree = rootRoute.addChildren([newApiRoute])

    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/my-app/legacy/api/v1'],
      }),
      basepath: 'my-app',
      rewrite: {
        input: ({ url }) => {
          if (url.pathname === '/legacy/api/v1') {
            url.pathname = '/api/v2'
            return url
          }
          return undefined
        },
      },
    })

    render(<RouterProvider router={router} />)

    expect(await screen.findByTestId('api-v2')).toBeInTheDocument()

    // Should first remove basepath (/my-app/legacy/api/v1 -> /legacy/api/v1)
    // Then apply additional rewrite (/legacy/api/v1 -> /api/v2)
    expect(router.state.location.pathname).toBe('/api/v2')
  })

  it('should preserve search params and hash when rewriting basepath', async () => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const searchRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/search',
      component: () => <div data-testid="search">Search</div>,
    })

    const routeTree = rootRoute.addChildren([searchRoute])

    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/app/search?q=test&filter=all#results'],
      }),
      basepath: 'app',
    })

    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(screen.getByTestId('search')).toBeInTheDocument()
    })

    expect(router.state.location.pathname).toBe('/search')
    expect(router.state.location.search).toEqual({
      q: 'test',
      filter: 'all',
    })
    expect(router.state.location.hash).toBe('results')
  })

  it('should handle nested basepath with multiple rewrite layers', async () => {
    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const finalRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/final',
      component: () => <div data-testid="final">Final</div>,
    })

    const routeTree = rootRoute.addChildren([finalRoute])

    const router = createRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/base/legacy/old/path'],
      }),
      basepath: 'base',
      rewrite: composeRewrites([
        {
          input: ({ url }) => {
            // First layer: convert legacy paths
            if (url.pathname === '/legacy/old/path') {
              url.pathname = '/new/path'
              return url
            }
            return undefined
          },
          output: ({ url }) => {
            // First layer: convert legacy paths
            if (url.pathname === '/new/path') {
              url.pathname = '/legacy/old/path'
              return url
            }
            return undefined
          },
        },
      ]),
    })

    // Add a second rewrite layer
    const originalRewrite = router.options.rewrite
    router.update({
      rewrite: composeRewrites([
        originalRewrite!,
        {
          input: ({ url }) => {
            if (url.pathname === '/new/path') {
              url.pathname = '/final'
            }
            return url
          },
          output: ({ url }) => {
            if (url.pathname === '/final') {
              url.pathname = '/new/path'
            }
            return url
          },
        },
      ]),
    })

    render(<RouterProvider router={router} />)

    expect(router.state.location.pathname).toBe('/final')
    expect(await screen.findByTestId('final')).toBeInTheDocument()

    // Should apply: /base/legacy/old/path -> /legacy/old/path -> /new/path -> /final
  })

  it('should handle basepath with output rewriting', async () => {
    // This test verifies that basepath is added back when navigating

    const rootRoute = createRootRoute({
      component: () => <Outlet />,
    })

    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <div>
          <Link to="/about" data-testid="about-link">
            About
          </Link>
        </div>
      ),
    })

    const aboutRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      component: () => <div data-testid="about">About</div>,
    })

    const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])

    const history = createMemoryHistory({ initialEntries: ['/my-app/'] })

    const router = createRouter({
      routeTree,
      history,
      basepath: 'my-app',
    })

    render(<RouterProvider router={router} />)

    const aboutLink = await screen.findByTestId('about-link')

    fireEvent.click(aboutLink)

    await waitFor(() => {
      expect(screen.getByTestId('about')).toBeInTheDocument()
    })

    expect(router.state.location.pathname).toBe('/about')
    expect(history.location.pathname).toBe('/my-app/about')
  })
})
