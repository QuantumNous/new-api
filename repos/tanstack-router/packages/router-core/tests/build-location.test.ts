import { describe, expect, test, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/history'
import {
  BaseRootRoute,
  BaseRoute,
  retainSearchParams,
  stripSearchParams,
} from '../src'
import { createTestRouter } from './routerTestUtils'

describe('buildLocation - params function receives parsed params', () => {
  test('prev params should contain parsed params from route params.parse', async () => {
    const rootRoute = new BaseRootRoute({})

    // Create a route with params.parse that transforms string to number
    const userRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
      params: {
        parse: ({ userId }: { userId: string }) => ({
          userId: parseInt(userId, 10),
        }),
      },
    })

    const routeTree = rootRoute.addChildren([userRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users/123'] }),
    })

    // Load to establish current location with parsed params
    await router.load()

    // Track what params the function receives (clone to avoid mutation)
    const updater = vi.fn()

    router.buildLocation({
      from: '/users/$userId',
      to: '/users/$userId',
      params: updater,
    })

    // The prev params should be parsed (number), not raw string
    expect(updater).toHaveBeenCalledOnce()
    expect(updater).toHaveBeenCalledWith({ userId: 123 })
  })

  test('prev params should accumulate parsed params from all routes in the branch', async () => {
    const rootRoute = new BaseRootRoute({})

    // Parent route with params.parse
    const orgRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/orgs/$orgId',
      params: {
        parse: ({ orgId }: { orgId: string }) => ({
          orgId: parseInt(orgId, 10),
        }),
      },
    })

    // Child route with its own params.parse
    const userRoute = new BaseRoute({
      getParentRoute: () => orgRoute,
      path: '/users/$userId',
      params: {
        parse: ({ userId }: { userId: string }) => ({
          userId: parseInt(userId, 10),
        }),
      },
    })

    const routeTree = rootRoute.addChildren([orgRoute.addChildren([userRoute])])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/orgs/42/users/123'] }),
    })

    await router.load()

    const updater = vi.fn()

    router.buildLocation({
      from: '/orgs/$orgId/users/$userId',
      to: '/orgs/$orgId/users/$userId',
      params: updater,
    })

    // Both params should be parsed (numbers)
    expect(updater).toHaveBeenCalledOnce()
    expect(updater).toHaveBeenCalledWith({ orgId: 42, userId: 123 })
  })

  test('prev params should contain parsed params when navigating to different route', async () => {
    const rootRoute = new BaseRootRoute({})

    const userRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
      params: {
        parse: ({ userId }: { userId: string }) => ({
          userId: parseInt(userId, 10),
        }),
      },
    })

    const postRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/$postId',
      params: {
        parse: ({ postId }: { postId: string }) => ({
          postId: parseInt(postId, 10),
        }),
      },
    })

    const routeTree = rootRoute.addChildren([userRoute, postRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users/123'] }),
    })

    await router.load()

    const updater = vi.fn()

    // Navigate from /users/$userId to /posts/$postId
    // The prev should contain parsed params from the current (from) route
    router.buildLocation({
      from: '/users/$userId',
      to: '/posts/$postId',
      params: updater,
    })

    // The prev params should be from the current route (parsed userId)
    // Note: prev may also contain the new postId param merged in
    expect(updater).toHaveBeenCalledOnce()
    expect(updater).toHaveBeenCalledWith({ userId: 123 })
  })

  test('params without parse function remain as strings in prev', async () => {
    const rootRoute = new BaseRootRoute({})

    // Route without params.parse
    const userRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
    })

    const routeTree = rootRoute.addChildren([userRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users/123'] }),
    })

    await router.load()

    const updater = vi.fn()

    router.buildLocation({
      from: '/users/$userId',
      to: '/users/$userId',
      params: updater,
    })

    // Without params.parse, the param should remain a string
    expect(updater).toHaveBeenCalledOnce()
    expect(updater).toHaveBeenCalledWith({ userId: '123' })
  })

  test('mixed routes with and without params.parse', async () => {
    const rootRoute = new BaseRootRoute({})

    // Parent route WITH params.parse
    const orgRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/orgs/$orgId',
      params: {
        parse: ({ orgId }: { orgId: string }) => ({
          orgId: parseInt(orgId, 10),
        }),
      },
    })

    // Child route WITHOUT params.parse
    const teamRoute = new BaseRoute({
      getParentRoute: () => orgRoute,
      path: '/teams/$teamSlug',
    })

    const routeTree = rootRoute.addChildren([orgRoute.addChildren([teamRoute])])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/orgs/42/teams/engineering'],
      }),
    })

    await router.load()

    const updater = vi.fn()

    router.buildLocation({
      from: '/orgs/$orgId/teams/$teamSlug',
      to: '/orgs/$orgId/teams/$teamSlug',
      params: updater,
    })

    expect(updater).toHaveBeenCalledOnce()
    expect(updater).toHaveBeenCalledWith({ orgId: 42, teamSlug: 'engineering' })
  })
})

describe('buildLocation - search params', () => {
  test('retainSearchParams should preserve current search over defaults during navigation', async () => {
    const rootRoute = new BaseRootRoute({
      validateSearch: (search: Record<string, unknown>) => ({
        Auth: search.Auth === undefined ? 'true' : `${search.Auth}`,
      }),
      search: {
        middlewares: [retainSearchParams(['Auth'])],
      },
    })
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })
    const aboutRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
    })

    const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/about?Auth=false'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/',
      _includeValidateSearch: true,
    } as any)

    expect(location.search).toEqual({ Auth: 'false' })
  })

  test('retainSearchParams should not replace defaults with missing current search', async () => {
    const rootRoute = new BaseRootRoute({
      validateSearch: (search: Record<string, unknown>) => ({
        Auth: search.Auth === undefined ? 'true' : `${search.Auth}`,
      }),
      search: {
        middlewares: [retainSearchParams(['Auth'])],
      },
    })
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/',
      _includeValidateSearch: true,
    } as any)

    expect(location.search).toEqual({ Auth: 'true' })
  })

  test('retainSearchParams should not restore default-valued params removed by stripSearchParams', async () => {
    const defaults = {
      param1: 1,
      param2: 2,
    }
    const rootRoute = new BaseRootRoute({})
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      validateSearch: (search: Record<string, unknown>) => ({
        param1: search.param1 === undefined ? defaults.param1 : search.param1,
        param2: search.param2 === undefined ? defaults.param2 : search.param2,
      }),
      search: {
        middlewares: [
          retainSearchParams(['param2']),
          stripSearchParams(defaults),
        ],
      },
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/?param2=2'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/',
      search: { param1: 10 },
      _includeValidateSearch: true,
    } as any)

    expect(location.search).toEqual({ param1: 10 })
  })

  test('retainSearchParams should allow explicit default params to reset current params when stripSearchParams removes them', async () => {
    const defaults = {
      param1: 1,
      param2: 2,
    }
    const rootRoute = new BaseRootRoute({})
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      validateSearch: (search: Record<string, unknown>) => ({
        param1: search.param1 === undefined ? defaults.param1 : search.param1,
        param2: search.param2 === undefined ? defaults.param2 : search.param2,
      }),
      search: {
        middlewares: [
          retainSearchParams(['param1', 'param2']),
          stripSearchParams(defaults),
        ],
      },
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/?param1=10'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/',
      search: defaults,
      _includeValidateSearch: true,
    } as any)

    expect(location.search).toEqual({})
  })

  test('retainSearchParams(true) should allow explicit default params to reset current params when stripSearchParams removes them', async () => {
    const defaults = {
      param1: 1,
      param2: 2,
    }
    const rootRoute = new BaseRootRoute({})
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      validateSearch: (search: Record<string, unknown>) => ({
        param1: search.param1 === undefined ? defaults.param1 : search.param1,
        param2: search.param2 === undefined ? defaults.param2 : search.param2,
      }),
      search: {
        middlewares: [retainSearchParams(true), stripSearchParams(defaults)],
      },
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/?param1=10'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/',
      search: defaults,
      _includeValidateSearch: true,
    } as any)

    expect(location.search).toEqual({})
  })

  test('retainSearchParams should not restore params explicitly removed by stripSearchParams', async () => {
    const rootRoute = new BaseRootRoute({})
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      search: {
        middlewares: [
          retainSearchParams(['param2']),
          stripSearchParams<Record<string, unknown>>(['param2']),
        ],
      },
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/?param2=not-default'],
      }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/',
      search: { param1: 10 },
    } as any)

    expect(location.search).toEqual({ param1: 10 })
  })

  test('nested retainSearchParams should preserve stripped param metadata', async () => {
    const rootRoute = new BaseRootRoute({})
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      search: {
        middlewares: [
          retainSearchParams(['param1']),
          retainSearchParams(['param2']),
          stripSearchParams<Record<string, unknown>>(['param1']),
        ],
      },
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/?param1=stripped&param2=retained'],
      }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/',
      search: { param3: 'next' },
    } as any)

    expect(location.search).toEqual({ param2: 'retained', param3: 'next' })
  })

  test('retainSearchParams should preserve non-default params when defaults are stripped', async () => {
    const rootRoute = new BaseRootRoute({
      validateSearch: (search: Record<string, unknown>) => ({
        Auth: search.Auth === undefined ? 'true' : `${search.Auth}`,
      }),
      search: {
        middlewares: [
          retainSearchParams(['Auth']),
          stripSearchParams({ Auth: 'true' }),
        ],
      },
    })
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })
    const aboutRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
    })

    const routeTree = rootRoute.addChildren([indexRoute, aboutRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/about?Auth=false'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/',
      _includeValidateSearch: true,
    } as any)

    expect(location.search).toEqual({ Auth: 'false' })
  })

  test('retainSearchParams should keep downstream values added after validation', async () => {
    const rootRoute = new BaseRootRoute({
      validateSearch: (search: Record<string, unknown>) => ({
        Auth: search.Auth === undefined ? 'default' : `${search.Auth}`,
      }),
      search: {
        middlewares: [
          retainSearchParams(['Auth']),
          ({ search, next }) => ({ ...next(search), Auth: 'explicit' }),
        ],
      },
    })
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/?Auth=current'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/',
      _includeValidateSearch: true,
    } as any)

    expect(location.search).toEqual({ Auth: 'explicit' })
  })

  test('retainSearchParams(true) should preserve nested current search over defaults during navigation', async () => {
    const rootRoute = new BaseRootRoute({
      validateSearch: (search: Record<string, unknown>) => ({
        filter: Array.isArray(search.filter) ? search.filter : ['default'],
        filterOrder:
          typeof search.filterOrder === 'object' && search.filterOrder
            ? search.filterOrder
            : {},
        anotherFilterOrder: Array.isArray(search.anotherFilterOrder)
          ? search.anotherFilterOrder
          : [],
      }),
      search: {
        middlewares: [retainSearchParams(true)],
      },
    })
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    await router.load()

    const currentLocation = router.buildLocation({
      to: '/',
      search: { filterOrder: { filter1: [1], filter2: [0] } },
      _includeValidateSearch: true,
    } as any)

    const location = router.buildLocation({
      to: '/',
      _fromLocation: currentLocation,
      _includeValidateSearch: true,
    } as any)

    expect(location.search).toEqual({
      filter: ['default'],
      filterOrder: { filter1: [1], filter2: [0] },
      anotherFilterOrder: [],
    })
  })

  test('retainSearchParams(true) should preserve nested search when navigating to the same route', async () => {
    const rootRoute = new BaseRootRoute({
      validateSearch: (search: Record<string, unknown>) => ({
        filter: Array.isArray(search.filter) ? search.filter : ['default'],
        filterOrder:
          typeof search.filterOrder === 'object' && search.filterOrder
            ? search.filterOrder
            : {},
        anotherFilterOrder: Array.isArray(search.anotherFilterOrder)
          ? search.anotherFilterOrder
          : [],
      }),
      search: {
        middlewares: [retainSearchParams(true)],
      },
    })
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })

    const routeTree = rootRoute.addChildren([indexRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    await router.load()

    await router.navigate({
      to: '/',
      search: { filterOrder: { filter1: [1], filter2: [0] } },
    } as any)

    expect(router.latestLocation.search).toEqual({
      filter: ['default'],
      filterOrder: { filter1: [1], filter2: [0] },
      anotherFilterOrder: [],
    })

    await router.navigate({ to: '/' })

    expect(router.latestLocation.search).toEqual({
      filter: ['default'],
      filterOrder: { filter1: [1], filter2: [0] },
      anotherFilterOrder: [],
    })
  })

  test('retainSearchParams should preserve root search during navigation', async () => {
    const rootRoute = new BaseRootRoute({
      validateSearch: (search: Record<string, unknown>) => ({
        rootValue: search.rootValue as string | undefined,
      }),
      search: {
        middlewares: [retainSearchParams(['rootValue'])],
      },
    })
    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
    })
    const settingsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/settings',
    })
    const aboutRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
      validateSearch: (search: Record<string, unknown>) => ({
        param1: search.param1 as string | undefined,
      }),
    })

    const routeTree = rootRoute.addChildren([
      indexRoute,
      settingsRoute,
      aboutRoute,
    ])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/settings?rootValue=value'],
      }),
    })

    await router.load()

    const linkLocation = router.buildLocation({ to: '/about' })
    expect(linkLocation.search).toEqual({ rootValue: 'value' })

    await router.navigate({ to: '/about' })

    expect(router.latestLocation.pathname).toBe('/about')
    expect(router.latestLocation.search).toEqual({ rootValue: 'value' })
  })

  test('search as object should set search params', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      search: { page: 1, filter: 'active' },
    })

    expect(location.search).toEqual({ page: 1, filter: 'active' })
    expect(location.searchStr).toContain('page=1')
    expect(location.searchStr).toContain('filter=active')
  })

  test('search as function should receive current search and return new search', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts?page=1'] }),
    })

    await router.load()

    const searchUpdater = vi.fn((prev: { page?: number }) => ({
      ...prev,
      page: (prev.page || 0) + 1,
    }))

    const location = router.buildLocation({
      to: '/posts',
      search: searchUpdater,
    })

    expect(searchUpdater).toHaveBeenCalledOnce()
    expect(searchUpdater).toHaveBeenCalledWith({ page: 1 })
    expect(location.search).toEqual({ page: 2 })
  })

  test('search: true should preserve current search params', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/posts?page=5&filter=active'],
      }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      search: true,
    })

    expect(location.search).toEqual({ page: 5, filter: 'active' })
  })

  test('search object should merge with current search when using function', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/posts?existing=value'],
      }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        newKey: 'newValue',
      }),
    })

    expect(location.search).toEqual({ existing: 'value', newKey: 'newValue' })
  })

  test('search with validateSearch on route should validate search params', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      validateSearch: (search: Record<string, unknown>) => ({
        page: Number(search.page) + 1,
      }),
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts?page=5'] }),
      search: { strict: true },
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      search: { page: 10 },
      _includeValidateSearch: true,
    } as any)

    expect(location.search).toEqual({ page: 11 })
  })

  test('empty search object should clear search params', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/posts?page=1&filter=active'],
      }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      search: {},
    })

    expect(location.search).toEqual({})
    expect(location.searchStr).toBe('')
  })

  test('search function returning empty object should clear search params', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/posts?page=1'],
      }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      search: () => ({}),
    })

    expect(location.search).toEqual({})
  })
})

describe('buildLocation - hash', () => {
  test('hash as string should set the hash', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      hash: 'section1',
    })

    expect(location.hash).toBe('section1')
    expect(location.href).toContain('#section1')
  })

  test('hash as function should receive current hash and return new hash', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts#current'] }),
    })

    await router.load()

    const hashUpdater = vi.fn((prev?: string) => `${prev}-updated`)

    const location = router.buildLocation({
      to: '/posts',
      hash: hashUpdater,
    })

    expect(hashUpdater).toHaveBeenCalledOnce()
    expect(hashUpdater).toHaveBeenCalledWith('current')
    expect(location.hash).toBe('current-updated')
  })

  test('hash: true should preserve current hash', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts#existing'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      hash: true,
    })

    expect(location.hash).toBe('existing')
    expect(location.href).toContain('#existing')
  })

  test('no hash option should result in empty hash', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts#existing'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
    })

    expect(location.hash).toBe('')
    expect(location.href).not.toContain('#')
  })

  test('empty string hash should clear the hash', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts#existing'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      hash: '',
    })

    expect(location.hash).toBe('')
    expect(location.href).not.toContain('#')
  })
})

describe('buildLocation - state', () => {
  test('state as object should set state', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      state: { modal: true, count: 5 } as any,
    })

    expect(location.state).toEqual({ modal: true, count: 5 })
  })

  test('state as function should receive current state and return new state', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const history = createMemoryHistory({ initialEntries: ['/posts'] })
    // Set initial state on history
    history.replace('/posts', { existing: 'value' })

    const router = createTestRouter({
      routeTree,
      history,
    })

    await router.load()

    const stateUpdater = vi.fn((prev: Record<string, unknown>) => ({
      ...prev,
      newKey: 'newValue',
    }))

    const location = router.buildLocation({
      to: '/posts',
      state: stateUpdater as any,
    })

    expect(stateUpdater).toHaveBeenCalledOnce()
    // State includes internal router keys, so use toMatchObject
    expect(location.state).toMatchObject({
      existing: 'value',
      newKey: 'newValue',
    })
  })

  test('state: true should preserve current state', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const history = createMemoryHistory({ initialEntries: ['/posts'] })
    history.replace('/posts', { preserved: true })

    const router = createTestRouter({
      routeTree,
      history,
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      state: true,
    })

    // State includes internal router keys, so use toMatchObject
    expect(location.state).toMatchObject({ preserved: true })
  })

  test('no state option should result in empty state', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const history = createMemoryHistory({ initialEntries: ['/posts'] })
    history.replace('/posts', { existing: 'value' })

    const router = createTestRouter({
      routeTree,
      history,
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
    })

    expect(location.state).toEqual({})
  })

  test('state can contain complex nested objects', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const complexState = {
      user: { id: 1, name: 'Test' },
      items: [1, 2, 3],
      nested: { deep: { value: true } },
    }

    const location = router.buildLocation({
      to: '/posts',
      state: complexState as any,
    })

    expect(location.state).toEqual(complexState)
  })
})

describe('buildLocation - relative paths', () => {
  test('absolute path should navigate to exact route', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })
    const aboutRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/about',
    })

    const routeTree = rootRoute.addChildren([postsRoute, aboutRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      from: '/posts',
      to: '/about',
    })

    expect(location.pathname).toBe('/about')
  })

  test('./ prefix should resolve relative to current route', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })
    const postDetailRoute = new BaseRoute({
      getParentRoute: () => postsRoute,
      path: '/detail',
    })

    const routeTree = rootRoute.addChildren([
      postsRoute.addChildren([postDetailRoute]),
    ])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: './detail',
    })

    expect(location.pathname).toBe('/posts/detail')
  })

  test('../ prefix should resolve up one path segment', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })
    const postDetailRoute = new BaseRoute({
      getParentRoute: () => postsRoute,
      path: '/detail',
    })
    const postAboutRoute = new BaseRoute({
      getParentRoute: () => postsRoute,
      path: '/about',
    })

    const routeTree = rootRoute.addChildren([
      postsRoute.addChildren([postDetailRoute, postAboutRoute]),
    ])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts/detail'] }),
    })

    await router.load()

    // ../ goes up one segment from 'detail' to 'posts', then adds 'about'
    const location = router.buildLocation({
      to: '../about',
    })

    expect(location.pathname).toBe('/posts/about')
  })

  test('multiple ../ should navigate up multiple path segments', async () => {
    const rootRoute = new BaseRootRoute({})
    const aRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/a',
    })
    const bRoute = new BaseRoute({
      getParentRoute: () => aRoute,
      path: '/b',
    })
    const cRoute = new BaseRoute({
      getParentRoute: () => bRoute,
      path: '/c',
    })
    const dRoute = new BaseRoute({
      getParentRoute: () => aRoute,
      path: '/d',
    })

    const routeTree = rootRoute.addChildren([
      aRoute.addChildren([bRoute.addChildren([cRoute]), dRoute]),
    ])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/a/b/c'] }),
    })

    await router.load()

    // ../../d from /a/b/c goes up from 'c' to 'b', then from 'b' to 'a', then adds 'd'
    const location = router.buildLocation({
      to: '../../d',
    })

    expect(location.pathname).toBe('/a/d')
  })

  test('. should stay on current route', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '.',
    })

    expect(location.pathname).toBe('/posts')
  })

  test('relative path with child segment', async () => {
    const rootRoute = new BaseRootRoute({})
    const usersRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users',
    })
    const userRoute = new BaseRoute({
      getParentRoute: () => usersRoute,
      path: '/$userId',
    })
    const settingsRoute = new BaseRoute({
      getParentRoute: () => userRoute,
      path: '/settings',
    })

    const routeTree = rootRoute.addChildren([
      usersRoute.addChildren([userRoute.addChildren([settingsRoute])]),
    ])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users'] }),
    })

    await router.load()

    const location = router.buildLocation({
      from: '/users/$userId',
      to: './settings',
      params: { userId: '123' },
    })

    expect(location.pathname).toBe('/users/123/settings')
  })
})

describe('buildLocation - basepath', () => {
  test('basepath should be included in href but not pathname', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      basepath: '/app',
      history: createMemoryHistory({ initialEntries: ['/app/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
    })

    // pathname is the route path without basepath
    expect(location.pathname).toBe('/posts')
    // href includes the basepath
    expect(location.href).toBe('/app/posts')
  })

  test('basepath should work with nested routes', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })
    const postRoute = new BaseRoute({
      getParentRoute: () => postsRoute,
      path: '/$postId',
    })

    const routeTree = rootRoute.addChildren([
      postsRoute.addChildren([postRoute]),
    ])

    const router = createTestRouter({
      routeTree,
      basepath: '/app',
      history: createMemoryHistory({ initialEntries: ['/app/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts/$postId',
      params: { postId: '123' },
    })

    expect(location.pathname).toBe('/posts/123')
    expect(location.href).toBe('/app/posts/123')
  })

  test('basepath with trailing slash should work correctly', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      basepath: '/app/',
      history: createMemoryHistory({ initialEntries: ['/app/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
    })

    // Should normalize the basepath correctly
    expect(location.pathname).toBe('/posts')
    expect(location.href).toBe('/app/posts')
  })

  test('navigating to root with basepath', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      basepath: '/app',
      history: createMemoryHistory({ initialEntries: ['/app/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/',
    })

    expect(location.pathname).toBe('/')
    // Root with basepath includes trailing slash
    expect(location.href).toBe('/app/')
  })
})

describe('buildLocation - params edge cases', () => {
  test('params: true should preserve current params', async () => {
    const rootRoute = new BaseRootRoute({})
    const userRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
    })

    const routeTree = rootRoute.addChildren([userRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users/123'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/users/$userId',
      params: true,
    })

    expect(location.pathname).toBe('/users/123')
  })

  test('params as object should set specific params', async () => {
    const rootRoute = new BaseRootRoute({})
    const userRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
    })

    const routeTree = rootRoute.addChildren([userRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users/123'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/users/$userId',
      params: { userId: '456' },
    })

    expect(location.pathname).toBe('/users/456')
  })

  test('params as object should merge with current params', async () => {
    const rootRoute = new BaseRootRoute({})
    const orgRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/orgs/$orgId',
    })
    const userRoute = new BaseRoute({
      getParentRoute: () => orgRoute,
      path: '/users/$userId',
    })

    const routeTree = rootRoute.addChildren([orgRoute.addChildren([userRoute])])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/orgs/abc/users/123'] }),
    })

    await router.load()

    // Only update userId, orgId should be preserved
    const location = router.buildLocation({
      to: '/orgs/$orgId/users/$userId',
      params: (prev: { orgId: string; userId: string }) => ({
        ...prev,
        userId: '456',
      }),
    })

    expect(location.pathname).toBe('/orgs/abc/users/456')
  })

  test('params.stringify should transform params with custom formatting', async () => {
    const rootRoute = new BaseRootRoute({})
    const userRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
      params: {
        parse: ({ userId }: { userId: string }) => ({
          userId: parseInt(userId, 10),
        }),
        // Stringify pads the userId to 6 digits
        stringify: ({ userId }: { userId: number }) => ({
          userId: String(userId).padStart(6, '0'),
        }),
      },
    })

    const routeTree = rootRoute.addChildren([userRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users/000123'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/users/$userId',
      params: { userId: 42 },
    })

    // Without stringify, this would be '/users/42'
    // With stringify, it should be padded to 6 digits
    expect(location.pathname).toBe('/users/000042')
  })

  test('params.stringify should run for params.parse route templates', async () => {
    const rootRoute = new BaseRootRoute({})
    const languageRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/{$language}',
      params: {
        parse: ({ language }: { language: string }) => {
          if (language === 'en') return { language: 'en-US' as const }
          if (language === 'pl') return { language: 'pl-PL' as const }
          return false
        },
        stringify: ({ language }: { language: 'en-US' | 'pl-PL' }) => {
          if (language === 'en-US') return { language: 'en' }
          if (language === 'pl-PL') return { language: 'pl' }
          return { language }
        },
      },
    })

    const routeTree = rootRoute.addChildren([languageRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/en'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/{$language}',
      params: { language: 'pl-PL' },
    })

    expect(location.pathname).toBe('/pl')

    const currentRouteLocation = router.buildLocation({
      params: { language: 'pl-PL' },
    } as any)

    expect(currentRouteLocation.pathname).toBe('/pl')
  })

  test('params.stringify should use the exact route template over path matching priority', async () => {
    const rootRoute = new BaseRootRoute({})
    const dollarRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/$value',
      params: {
        parse: ({ value }: { value: string }) => {
          if (value.startsWith('dollar-')) return { value }
          return false
        },
        stringify: ({ value }: { value: string }) => ({
          value: `dollar-${value}`,
        }),
      },
    })
    const curlyRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/{$value}',
      params: {
        parse: ({ value }: { value: string }) => {
          if (value.startsWith('curly-')) return { value }
          return false
        },
        stringify: ({ value }: { value: string }) => ({
          value: `curly-${value}`,
        }),
      },
    })

    const routeTree = rootRoute.addChildren([dollarRoute, curlyRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/dollar-home'] }),
    })

    await router.load()

    const curlyLocation = router.buildLocation({
      to: '/{$value}',
      params: { value: 'alpha' },
    })
    const dollarLocation = router.buildLocation({
      to: '/$value',
      params: { value: 'alpha' },
    })

    expect(curlyLocation.pathname).toBe('/curly-alpha')
    expect(dollarLocation.pathname).toBe('/dollar-alpha')
  })

  test('params.parse should gate path matching and provide typed params', async () => {
    const rootRoute = new BaseRootRoute({})
    const userRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
      params: {
        parse: ({ userId }: { userId: string }) => {
          const parsed = Number(userId)
          if (!Number.isInteger(parsed)) return false
          return { userId: parsed }
        },
        stringify: ({ userId }: { userId: number }) => ({
          userId: String(userId),
        }),
      },
    })

    const routeTree = rootRoute.addChildren([userRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users/123'] }),
    })

    await router.load()

    expect(router.state.matches.at(-1)?.params).toEqual({ userId: 123 })

    const location = router.buildLocation({
      to: '/users/$userId',
      params: { userId: 456 },
    })

    expect(location.pathname).toBe('/users/456')
  })

  test('buildLocation should warn in development when stringified params do not match the target route', async () => {
    const rootRoute = new BaseRootRoute({})
    const staticRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/no',
    })
    const dynamicRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/$foo',
      params: {
        stringify: () => ({ foo: 'no' }),
      },
    })

    const routeTree = rootRoute.addChildren([staticRoute, dynamicRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/yes'] }),
    })

    await router.load()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const location = router.buildLocation({
        to: '/$foo',
        params: { foo: 'yes' },
      })

      expect(location.pathname).toBe('/no')
      expect(warn).toHaveBeenCalledWith(
        'Generated path "/no" for route "/$foo" matched route "/no" instead. This can happen when multiple route templates resolve to the same URL. Use the route template that matches the intended route, or adjust params.stringify if it changed the target path.',
      )
    } finally {
      warn.mockRestore()
    }
  })

  test('buildLocation should warn in development when a generated path matches an optional route template', async () => {
    const rootRoute = new BaseRootRoute({})
    const timeRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/time',
    })
    const dayRoute = new BaseRoute({
      getParentRoute: () => timeRoute,
      path: '{-$day}',
    })

    const routeTree = rootRoute.addChildren([timeRoute.addChildren([dayRoute])])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })

    await router.load()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    try {
      const location = router.buildLocation({
        to: '/time',
      })

      expect(location.pathname).toBe('/time')
      expect(warn).toHaveBeenCalledWith(
        'Generated path "/time" for route "/time" matched route "/time/{-$day}" instead. This can happen when multiple route templates resolve to the same URL. Use the route template that matches the intended route, or adjust params.stringify if it changed the target path.',
      )
    } finally {
      warn.mockRestore()
    }
  })

  test('params.stringify in nested routes should all be applied', async () => {
    const rootRoute = new BaseRootRoute({})
    const orgRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/orgs/$orgId',
      params: {
        parse: ({ orgId }: { orgId: string }) => ({
          orgId: parseInt(orgId, 10),
        }),
        // Prefix org IDs with 'org-'
        stringify: ({ orgId }: { orgId: number }) => ({
          orgId: `org-${orgId}`,
        }),
      },
    })
    const userRoute = new BaseRoute({
      getParentRoute: () => orgRoute,
      path: '/users/$userId',
      params: {
        parse: ({ userId }: { userId: string }) => ({
          userId: parseInt(userId, 10),
        }),
        // Prefix user IDs with 'user-'
        stringify: ({ userId }: { userId: number }) => ({
          userId: `user-${userId}`,
        }),
      },
    })

    const routeTree = rootRoute.addChildren([orgRoute.addChildren([userRoute])])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/orgs/org-1/users/user-1'],
      }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/orgs/$orgId/users/$userId',
      params: { orgId: 42, userId: 123 },
    })

    // Both stringify functions should be applied
    expect(location.pathname).toBe('/orgs/org-42/users/user-123')
  })

  test('params function can transform params', async () => {
    const rootRoute = new BaseRootRoute({})
    const userRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
    })

    const routeTree = rootRoute.addChildren([userRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users/123'] }),
    })

    await router.load()

    // Transform the userId by appending a suffix
    const location = router.buildLocation({
      to: '/users/$userId',
      params: (prev: { userId: string }) => ({
        userId: `${prev.userId}-updated`,
      }),
    })

    expect(location.pathname).toBe('/users/123-updated')
  })
})

describe('buildLocation - location output structure', () => {
  test('location should contain all expected properties', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      search: { page: 1 },
      hash: 'section',
      state: { modal: true } as any,
    })

    // Verify all expected properties exist
    expect(location).toEqual({
      external: false,
      hash: 'section',
      href: '/posts?page=1#section',
      pathname: '/posts',
      publicHref: '/posts?page=1#section',
      search: {
        page: 1,
      },
      searchStr: '?page=1',
      state: {
        modal: true,
      },
      unmaskOnReload: undefined,
    })
  })

  test('empty search should result in empty searchStr', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      search: {},
    })

    expect(location.searchStr).toBe('')
    expect(location.href).toBe('/posts')
  })
})

describe('buildLocation - optional params', () => {
  test('optional param provided should be included in pathname', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/{-$category}',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts/{-$category}',
      params: { category: 'tech' },
    })

    expect(location.pathname).toBe('/posts/tech')
  })

  test('optional param omitted should not appear in pathname', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/{-$category}',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts/{-$category}',
      params: {},
    })

    expect(location.pathname).toBe('/posts')
  })

  test('multiple optional params - all provided', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/{-$category}/{-$slug}',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts/{-$category}/{-$slug}',
      params: { category: 'tech', slug: 'hello-world' },
    })

    expect(location.pathname).toBe('/posts/tech/hello-world')
  })

  test('multiple optional params - partially provided', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/{-$category}/{-$slug}',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts/{-$category}/{-$slug}',
      params: { category: 'tech' },
    })

    expect(location.pathname).toBe('/posts/tech')
  })

  test('mixed required and optional params', async () => {
    const rootRoute = new BaseRootRoute({})
    const usersRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId/{-$tab}',
    })

    const routeTree = rootRoute.addChildren([usersRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users/123'] }),
    })

    await router.load()

    // With optional param
    const locationWithTab = router.buildLocation({
      to: '/users/$userId/{-$tab}',
      params: { userId: '123', tab: 'settings' },
    })
    expect(locationWithTab.pathname).toBe('/users/123/settings')

    // Without optional param
    const locationWithoutTab = router.buildLocation({
      to: '/users/$userId/{-$tab}',
      params: { userId: '123' },
    })
    expect(locationWithoutTab.pathname).toBe('/users/123')
  })
})

describe('buildLocation - splat params', () => {
  test('splat param should capture path segments', async () => {
    const rootRoute = new BaseRootRoute({})
    const docsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/docs/$',
    })

    const routeTree = rootRoute.addChildren([docsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/docs'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/docs/$',
      params: { _splat: 'getting-started/installation' },
    })

    expect(location.pathname).toBe('/docs/getting-started/installation')
  })

  test('splat param with single segment', async () => {
    const rootRoute = new BaseRootRoute({})
    const docsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/docs/$',
    })

    const routeTree = rootRoute.addChildren([docsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/docs'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/docs/$',
      params: { _splat: 'overview' },
    })

    expect(location.pathname).toBe('/docs/overview')
  })

  test('splat param empty should result in base path', async () => {
    const rootRoute = new BaseRootRoute({})
    const docsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/docs/$',
    })

    const routeTree = rootRoute.addChildren([docsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/docs'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/docs/$',
      params: { _splat: '' },
    })

    expect(location.pathname).toBe('/docs')
  })

  test('splat param with prefix', async () => {
    const rootRoute = new BaseRootRoute({})
    const filesRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/files/prefix{$}',
    })

    const routeTree = rootRoute.addChildren([filesRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/files'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/files/prefix{$}',
      params: { _splat: 'path/to/file' },
    })

    expect(location.pathname).toBe('/files/prefixpath/to/file')
  })
})

describe('buildLocation - _fromLocation override', () => {
  test('_fromLocation should override current location for search resolution', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts?page=1'] }),
    })

    await router.load()

    // Override the current location with a different search
    const location = router.buildLocation({
      to: '/posts',
      search: true, // Preserve search from _fromLocation
      _fromLocation: {
        pathname: '/posts',
        search: { page: 5 },
        searchStr: '?page=5',
        hash: '',
        href: '/posts?page=5',
        state: {},
      },
    } as any)

    // Should use search from _fromLocation, not current location
    expect(location.search).toEqual({ page: 5 })
  })

  test('_fromLocation should override current location for hash resolution', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/posts#original'] }),
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      hash: true, // Preserve hash from _fromLocation
      _fromLocation: {
        pathname: '/posts',
        search: {},
        searchStr: '',
        hash: 'overridden',
        href: '/posts#overridden',
        state: {},
      },
    } as any)

    expect(location.hash).toBe('overridden')
  })

  test('_fromLocation should override current location for state resolution', async () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
    })

    const routeTree = rootRoute.addChildren([postsRoute])

    const history = createMemoryHistory({ initialEntries: ['/posts'] })
    history.replace('/posts', { original: true })

    const router = createTestRouter({
      routeTree,
      history,
    })

    await router.load()

    const location = router.buildLocation({
      to: '/posts',
      state: true, // Preserve state from _fromLocation
      _fromLocation: {
        pathname: '/posts',
        search: {},
        searchStr: '',
        hash: '',
        href: '/posts',
        state: { overridden: true },
      },
    } as any)

    expect(location.state).toMatchObject({ overridden: true })
  })

  test('_fromLocation should be used for relative path resolution', async () => {
    const rootRoute = new BaseRootRoute({})
    const usersRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users',
    })
    const userRoute = new BaseRoute({
      getParentRoute: () => usersRoute,
      path: '/$userId',
    })
    const settingsRoute = new BaseRoute({
      getParentRoute: () => userRoute,
      path: '/settings',
    })

    const routeTree = rootRoute.addChildren([
      usersRoute.addChildren([userRoute.addChildren([settingsRoute])]),
    ])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/users/123'] }),
    })

    await router.load()

    // When _fromLocation is provided, it affects the context for resolution
    const location = router.buildLocation({
      to: './settings',
      params: { userId: '456' },
      _fromLocation: {
        pathname: '/users/456',
        search: {},
        searchStr: '',
        hash: '',
        href: '/users/456',
        state: {},
      },
    } as any)

    expect(location.pathname).toBe('/users/456/settings')
  })
})
