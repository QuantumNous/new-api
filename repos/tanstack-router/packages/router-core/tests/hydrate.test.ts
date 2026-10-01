import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/history'
import { BaseRootRoute, BaseRoute, notFound } from '../src'
import { hydrate } from '../src/ssr/client'
import { createTestRouter } from './routerTestUtils'
import { dehydrateSsrMatchId } from '../src/ssr/ssr-match-id'
import type { LocationRewrite } from '../src'
import type { TsrSsrGlobal } from '../src/ssr/types'
import type { AnyRouteMatch } from '../src'
import type { Manifest } from '../src/manifest'

const testManifest: Manifest = {
  routes: {},
}

describe('hydrate', () => {
  let mockWindow: { $_TSR?: TsrSsrGlobal }
  let mockRouter: any
  let mockHead: any

  beforeEach(() => {
    // Reset global window mock
    mockWindow = {}
    ;(global as any).window = mockWindow

    // Reset mock head function
    mockHead = vi.fn()

    const history = createMemoryHistory({ initialEntries: ['/'] })

    const rootRoute = new BaseRootRoute({})

    const indexRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => 'Index',
      notFoundComponent: () => 'Not Found',
      head: mockHead,
    })

    const otherRoute = new BaseRoute({
      getParentRoute: () => indexRoute,
      path: '/other',
      component: () => 'Other',
    })

    const routeTree = rootRoute.addChildren([
      indexRoute.addChildren([otherRoute]),
    ])

    mockRouter = createTestRouter({ routeTree, history, isServer: true })
  })

  afterEach(() => {
    vi.resetAllMocks()
    delete (global as any).window
  })

  it('should throw error if window.$_TSR is not available', async () => {
    await expect(hydrate(mockRouter)).rejects.toThrow(
      'Expected to find bootstrap data on window.$_TSR, but we did not. Please file an issue!',
    )
  })

  it('should throw error if window.$_TSR.router is not available', async () => {
    mockWindow.$_TSR = {
      c: vi.fn(),
      p: vi.fn(),
      buffer: [],
      initialized: false,
      // router is missing
    } as any

    await expect(hydrate(mockRouter)).rejects.toThrow(
      'Expected to find a dehydrated data on window.$_TSR.router, but we did not. Please file an issue!',
    )
  })

  it('should initialize serialization adapters when provided', async () => {
    const mockSerializer = {
      key: 'testAdapter',
      fromSerializable: vi.fn(),
      toSerializable: vi.fn(),
      test: vi.fn().mockReturnValue(true),
      '~types': {
        input: {},
        output: {},
        extends: {},
      },
    }

    mockRouter.options.serializationAdapters = [mockSerializer]

    const mockMatches = [{ id: '/', routeId: '/', index: 0, _nonReactive: {} }]
    mockRouter.matchRoutes = vi.fn().mockReturnValue(mockMatches)
    mockRouter.state.matches = mockMatches

    const mockBuffer = [vi.fn(), vi.fn()]
    mockWindow.$_TSR = {
      router: {
        manifest: testManifest,
        dehydratedData: {},
        lastMatchId: '/',
        matches: [],
      },
      h: vi.fn(),
      e: vi.fn(),
      c: vi.fn(),
      p: vi.fn(),
      buffer: mockBuffer,
      initialized: false,
    }

    await hydrate(mockRouter)

    expect(mockWindow.$_TSR.t).toBeInstanceOf(Map)
    expect(mockWindow.$_TSR.t?.get('testAdapter')).toBe(
      mockSerializer.fromSerializable,
    )
    expect(mockBuffer[0]).toHaveBeenCalled()
    expect(mockBuffer[1]).toHaveBeenCalled()
    expect(mockWindow.$_TSR.initialized).toBe(true)
  })

  it('should handle empty serialization adapters', async () => {
    mockRouter.options.serializationAdapters = []

    mockWindow.$_TSR = {
      router: {
        manifest: testManifest,
        dehydratedData: {},
        lastMatchId: '/',
        matches: [],
      },
      h: vi.fn(),
      e: vi.fn(),
      c: vi.fn(),
      p: vi.fn(),
      buffer: [],
      initialized: false,
    }

    await hydrate(mockRouter)

    expect(mockWindow.$_TSR.t).toBeUndefined()
    expect(mockWindow.$_TSR.initialized).toBe(true)
  })

  it('should set manifest in router.ssr', async () => {
    mockWindow.$_TSR = {
      router: {
        manifest: testManifest,
        dehydratedData: {},
        lastMatchId: '/',
        matches: [],
      },
      h: vi.fn(),
      e: vi.fn(),
      c: vi.fn(),
      p: vi.fn(),
      buffer: [],
      initialized: false,
    }

    await hydrate(mockRouter)

    expect(mockRouter.ssr).toEqual({
      manifest: testManifest,
    })
  })

  it('should hydrate matches', async () => {
    const mockMatches = [
      {
        id: '/',
        routeId: '/',
        index: 0,
        ssr: undefined,
        _nonReactive: {},
      },
      {
        id: '/other',
        routeId: '/other',
        index: 1,
        ssr: undefined,
        _nonReactive: {},
      },
    ]

    const dehydratedMatches = [
      {
        i: '/',
        l: { indexData: 'server-data' },
        s: 'success' as const,
        ssr: true,
        u: Date.now(),
      },
    ]

    mockRouter.matchRoutes = vi.fn().mockReturnValue(mockMatches)
    mockRouter.state.matches = mockMatches

    mockWindow.$_TSR = {
      router: {
        manifest: testManifest,
        dehydratedData: {},
        lastMatchId: '/',
        matches: dehydratedMatches,
      },
      h: vi.fn(),
      e: vi.fn(),
      c: vi.fn(),
      p: vi.fn(),
      buffer: [],
      initialized: false,
    }

    await hydrate(mockRouter)

    const { id, loaderData, ssr, status } = mockMatches[0] as AnyRouteMatch
    expect(id).toBe('/')
    expect(loaderData).toEqual({ indexData: 'server-data' })
    expect(status).toBe('success')
    expect(ssr).toBe(true)
  })

  it('should hydrate globalNotFound when dehydrated flag is present', async () => {
    const mockMatches = [
      {
        id: '/',
        routeId: '/',
        index: 0,
        ssr: undefined,
        _nonReactive: {},
      },
    ]

    const dehydratedMatches = [
      {
        i: '/',
        s: 'success' as const,
        ssr: true,
        u: Date.now(),
        g: true as const,
      },
    ]

    mockRouter.matchRoutes = vi.fn().mockReturnValue(mockMatches)
    mockRouter.state.matches = mockMatches

    mockWindow.$_TSR = {
      router: {
        manifest: testManifest,
        dehydratedData: {},
        lastMatchId: '/',
        matches: dehydratedMatches,
      },
      h: vi.fn(),
      e: vi.fn(),
      c: vi.fn(),
      p: vi.fn(),
      buffer: [],
      initialized: false,
    }

    await hydrate(mockRouter)

    expect((mockMatches[0] as AnyRouteMatch).globalNotFound).toBe(true)
  })

  it('should leave globalNotFound undefined when dehydrated flag is omitted', async () => {
    const mockMatches = [
      {
        id: '/',
        routeId: '/',
        index: 0,
        ssr: undefined,
        _nonReactive: {},
      },
    ]

    const dehydratedMatches = [
      {
        i: '/',
        s: 'success' as const,
        ssr: true,
        u: Date.now(),
      },
    ]

    mockRouter.matchRoutes = vi.fn().mockReturnValue(mockMatches)
    mockRouter.state.matches = mockMatches

    mockWindow.$_TSR = {
      router: {
        manifest: testManifest,
        dehydratedData: {},
        lastMatchId: '/',
        matches: dehydratedMatches,
      },
      h: vi.fn(),
      e: vi.fn(),
      c: vi.fn(),
      p: vi.fn(),
      buffer: [],
      initialized: false,
    }

    await hydrate(mockRouter)

    expect((mockMatches[0] as AnyRouteMatch).globalNotFound).toBeUndefined()
  })

  it('should preserve existing globalNotFound when dehydrated flag is omitted', async () => {
    const mockMatches = [
      {
        id: '/',
        routeId: '/',
        index: 0,
        ssr: undefined,
        _nonReactive: {},
        globalNotFound: true,
      },
    ]

    const dehydratedMatches = [
      {
        i: '/',
        s: 'success' as const,
        ssr: true,
        u: Date.now(),
      },
    ]

    mockRouter.matchRoutes = vi.fn().mockReturnValue(mockMatches)
    mockRouter.state.matches = mockMatches

    mockWindow.$_TSR = {
      router: {
        manifest: testManifest,
        dehydratedData: {},
        lastMatchId: '/',
        matches: dehydratedMatches,
      },
      h: vi.fn(),
      e: vi.fn(),
      c: vi.fn(),
      p: vi.fn(),
      buffer: [],
      initialized: false,
    }

    await hydrate(mockRouter)

    expect((mockMatches[0] as AnyRouteMatch).globalNotFound).toBe(true)
  })

  it('should decode dehydrated match ids before hydration lookup and SPA-mode checks', async () => {
    const loadSpy = vi.spyOn(mockRouter, 'load')

    const mockMatches = [
      {
        id: '/',
        routeId: '/',
        index: 0,
        ssr: undefined,
        _nonReactive: {},
      },
    ]

    mockRouter.matchRoutes = vi.fn().mockReturnValue(mockMatches)
    mockRouter.state.matches = mockMatches

    mockWindow.$_TSR = {
      router: {
        manifest: testManifest,
        dehydratedData: {},
        lastMatchId: dehydrateSsrMatchId('/'),
        matches: [
          {
            i: dehydrateSsrMatchId('/'),
            l: { indexData: 'server-data' },
            s: 'success',
            ssr: true,
            u: Date.now(),
          },
        ],
      },
      h: vi.fn(),
      e: vi.fn(),
      c: vi.fn(),
      p: vi.fn(),
      buffer: [],
      initialized: false,
    }

    await hydrate(mockRouter)

    expect(loadSpy).not.toHaveBeenCalled()
    expect((mockRouter.state.matches[0] as AnyRouteMatch).id).toBe('/')
  })

  it('should run custom hydration before matching routes', async () => {
    const history = createMemoryHistory({ initialEntries: ['/public'] })

    const rootRoute = new BaseRootRoute({})
    const internalRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/internal',
      component: () => 'Internal',
    })

    const rewrite: LocationRewrite = {
      input: ({ url }) => {
        if (url.pathname === '/public') {
          url.pathname = '/internal'
        }
        return url
      },
    }

    mockRouter = createTestRouter({
      routeTree: rootRoute.addChildren([internalRoute]),
      history,
      isServer: true,
      hydrate: (dehydrated: { rewrite?: boolean }) => {
        if (dehydrated.rewrite) {
          mockRouter.update({ rewrite })
        }
      },
    })

    mockWindow.$_TSR = {
      router: {
        manifest: testManifest,
        dehydratedData: { rewrite: true },
        lastMatchId: '/internal/internal',
        matches: [
          {
            i: '__root__/',
            s: 'success',
            ssr: true,
            u: Date.now(),
          },
          {
            i: '/internal/internal',
            s: 'success',
            ssr: true,
            u: Date.now(),
          },
        ],
      },
      h: vi.fn(),
      e: vi.fn(),
      c: vi.fn(),
      p: vi.fn(),
      buffer: [],
      initialized: false,
    }

    await hydrate(mockRouter)

    expect(mockRouter.state.location.pathname).toBe('/internal')
    expect(mockRouter.state.location.publicHref).toBe('/public')
    expect(
      mockRouter.state.matches.map((match: AnyRouteMatch) => match.routeId),
    ).toEqual(['__root__', '/internal'])
  })

  it('should handle errors during route context hydration', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockHead.mockImplementation(() => {
      throw notFound()
    })

    const mockMatches = [
      { id: '/', routeId: '/', index: 0, ssr: true, _nonReactive: {} },
    ]

    mockRouter.matchRoutes = vi.fn().mockReturnValue(mockMatches)
    mockRouter.state.matches = mockMatches

    mockWindow.$_TSR = {
      router: {
        manifest: testManifest,
        dehydratedData: {},
        lastMatchId: '/',
        matches: [
          {
            i: '/',
            l: { data: 'test' },
            s: 'success',
            ssr: true,
            u: Date.now(),
          },
        ],
      },
      h: vi.fn(),
      e: vi.fn(),
      c: vi.fn(),
      p: vi.fn(),
      buffer: [],
      initialized: false,
    }

    await hydrate(mockRouter)

    const match = mockRouter.state.matches[0] as AnyRouteMatch
    expect(match.error).toEqual({ isNotFound: true })

    expect(consoleSpy).toHaveBeenCalledWith(
      'NotFound error during hydration for routeId: /',
      expect.objectContaining({
        isNotFound: true,
      }),
    )

    consoleSpy.mockRestore()
  })
})
