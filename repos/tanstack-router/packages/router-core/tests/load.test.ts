import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/history'
import {
  BaseRootRoute,
  BaseRoute,
  notFound,
  redirect,
  rootRouteId,
} from '../src'
import { createTestRouter } from './routerTestUtils'
import { loadMatches } from '../src/load-matches'
import type {
  AnyRouter,
  LoaderStaleReloadMode,
  RootRouteOptions,
  RouterCore,
} from '../src'

type AnyRouteOptions = RootRouteOptions<any>
type BeforeLoad = NonNullable<AnyRouteOptions['beforeLoad']>
type Loader = NonNullable<AnyRouteOptions['loader']>
type LoaderEntry = Exclude<Loader, Function>

describe('redirect resolution', () => {
  test('resolveRedirect normalizes same-origin Location to path-only', async () => {
    const rootRoute = new BaseRootRoute({})
    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
    })

    const routeTree = rootRoute.addChildren([fooRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['https://example.com/foo'],
      }),
      origin: 'https://example.com',
    })

    // This redirect already includes an absolute Location header (external-ish),
    // but still represents an internal navigation.
    const unresolved = redirect({
      to: '/foo',
      headers: { Location: 'https://example.com/foo' },
    })

    const resolved = router.resolveRedirect(unresolved)

    // Expect Location and stored href to be path-only (no origin).
    expect(resolved.headers.get('Location')).toBe('/foo')
    expect(resolved.options.href).toBe('/foo')
  })

  test.each(['/$a', '/$toString', '/$__proto__'])(
    'server startup redirects initial path %s to /undefined',
    async (initialPath) => {
      const rootRoute = new BaseRootRoute({})
      const slugRoute = new BaseRoute({
        getParentRoute: () => rootRoute,
        path: '/$slug',
      })

      const routeTree = rootRoute.addChildren([slugRoute])

      const router = createTestRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: [initialPath] }),
        isServer: true,
      })

      await router.load()

      expect(router.state.redirect).toEqual(
        expect.objectContaining({
          options: expect.objectContaining({ href: '/undefined' }),
        }),
      )
      expect(router.state.redirect?.headers.get('Location')).toBe('/undefined')
    },
  )
})

describe('notFound detection', () => {
  test('does not treat arbitrary proxy property access as notFound', async () => {
    const rootRoute = new BaseRootRoute({})
    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
      loader: () =>
        new Proxy(
          {},
          {
            get(_target, prop) {
              if (prop === 'isNotFound') return 'truthy-but-not-true'
              return undefined
            },
            has() {
              return true
            },
          },
        ),
    })

    const routeTree = rootRoute.addChildren([fooRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/foo'] }),
      isServer: true,
    })

    await router.load()

    expect(router.state.matches.at(-1)?.status).toBe('success')
    expect(router.state.matches.at(-1)?.error).toBeUndefined()
  })
})

describe('beforeLoad skip or exec', () => {
  const setup = ({ beforeLoad }: { beforeLoad?: BeforeLoad }) => {
    const rootRoute = new BaseRootRoute({})

    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
      beforeLoad,
    })

    const barRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/bar',
    })

    const routeTree = rootRoute.addChildren([fooRoute, barRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    return router
  }

  test('baseline', async () => {
    const beforeLoad = vi.fn()
    const router = setup({ beforeLoad })
    await router.load()
    expect(beforeLoad).toHaveBeenCalledTimes(0)
  })

  test('exec on regular nav', async () => {
    const beforeLoad = vi.fn(() => Promise.resolve({ hello: 'world' }))
    const router = setup({ beforeLoad })
    const navigation = router.navigate({ to: '/foo' })
    expect(beforeLoad).toHaveBeenCalledTimes(1)
    expect(router.stores.pendingMatches.get()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '/foo/foo' })]),
    )
    await navigation
    expect(router.state.location.pathname).toBe('/foo')
    expect(router.state.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '/foo/foo',
          context: {
            hello: 'world',
          },
        }),
      ]),
    )
    expect(beforeLoad).toHaveBeenCalledTimes(1)
  })

  test('preserves primitive errors thrown from beforeLoad', async () => {
    const beforeLoad = vi.fn<BeforeLoad>(() => {
      throw 'primitive error'
    })
    const router = setup({ beforeLoad })

    await router.navigate({ to: '/foo' })

    expect(router.state.statusCode).toBe(500)
    expect(router.state.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '/foo/foo',
          status: 'error',
          error: 'primitive error',
        }),
      ]),
    )
  })

  test('does not mutate object errors thrown from beforeLoad', async () => {
    const thrown = { type: 'domain-error' }
    const beforeLoad = vi.fn<BeforeLoad>(() => {
      throw thrown
    })
    const router = setup({ beforeLoad })

    await router.navigate({ to: '/foo' })

    expect(router.state.statusCode).toBe(500)
    expect(router.state.matches.find((d) => d.id === '/foo/foo')?.error).toBe(
      thrown,
    )
    expect(thrown).toEqual({ type: 'domain-error' })
  })

  test('exec if resolved preload (success)', async () => {
    const beforeLoad = vi.fn()
    const router = setup({ beforeLoad })
    await router.preloadRoute({ to: '/foo' })
    expect(router.stores.cachedMatches.get()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '/foo/foo' })]),
    )
    await sleep(10)
    await router.navigate({ to: '/foo' })

    expect(beforeLoad).toHaveBeenCalledTimes(2)
  })

  test('exec if pending preload (success)', async () => {
    const beforeLoad = vi.fn(() => sleep(100))
    const router = setup({ beforeLoad })
    router.preloadRoute({ to: '/foo' })
    await Promise.resolve()
    expect(router.stores.cachedMatches.get()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '/foo/foo' })]),
    )
    await router.navigate({ to: '/foo' })

    expect(beforeLoad).toHaveBeenCalledTimes(2)
  })

  test('exec if rejected preload (notFound)', async () => {
    const beforeLoad = vi.fn<BeforeLoad>(async ({ preload }) => {
      if (preload) throw notFound()
      await Promise.resolve()
    })
    const router = setup({
      beforeLoad,
    })
    await router.preloadRoute({ to: '/foo' })
    await sleep(10)
    await router.navigate({ to: '/foo' })

    expect(beforeLoad).toHaveBeenCalledTimes(2)
  })

  test('exec if pending preload (notFound)', async () => {
    const beforeLoad = vi.fn<BeforeLoad>(async ({ preload }) => {
      await sleep(100)
      if (preload) throw notFound()
    })
    const router = setup({
      beforeLoad,
    })
    router.preloadRoute({ to: '/foo' })
    await Promise.resolve()
    await router.navigate({ to: '/foo' })

    expect(beforeLoad).toHaveBeenCalledTimes(2)
  })

  test('exec if rejected preload (redirect)', async () => {
    const beforeLoad = vi.fn<BeforeLoad>(async ({ preload }) => {
      if (preload) throw redirect({ to: '/bar' })
      await Promise.resolve()
    })
    const router = setup({
      beforeLoad,
    })
    await router.preloadRoute({ to: '/foo' })
    expect(
      router.stores.cachedMatches.get().some((d) => d.status === 'redirected'),
    ).toBe(false)
    await sleep(10)
    await router.navigate({ to: '/foo' })

    expect(router.state.location.pathname).toBe('/foo')
    expect(
      router.stores.cachedMatches.get().some((d) => d.status === 'redirected'),
    ).toBe(false)
    expect(beforeLoad).toHaveBeenCalledTimes(2)
  })

  test('exec if pending preload (redirect)', async () => {
    const beforeLoad = vi.fn<BeforeLoad>(async ({ preload }) => {
      await sleep(100)
      if (preload) throw redirect({ to: '/bar' })
    })
    const router = setup({
      beforeLoad,
    })
    router.preloadRoute({ to: '/foo' })
    await Promise.resolve()
    expect(
      router.stores.cachedMatches.get().some((d) => d.status === 'redirected'),
    ).toBe(false)
    await router.navigate({ to: '/foo' })

    expect(router.state.location.pathname).toBe('/foo')
    expect(
      router.stores.cachedMatches.get().some((d) => d.status === 'redirected'),
    ).toBe(false)
    expect(beforeLoad).toHaveBeenCalledTimes(2)
  })

  test('exec if rejected preload (error)', async () => {
    const beforeLoad = vi.fn<BeforeLoad>(async ({ preload }) => {
      if (preload) throw new Error('error')
      await Promise.resolve()
    })
    const router = setup({
      beforeLoad,
    })
    await router.preloadRoute({ to: '/foo' })
    await sleep(10)
    await router.navigate({ to: '/foo' })

    expect(beforeLoad).toHaveBeenCalledTimes(2)
  })

  test('skip child beforeLoad when parent beforeLoad throws during preload', async () => {
    const parentBeforeLoad = vi.fn<BeforeLoad>(async ({ preload }) => {
      if (preload) throw new Error('parent error')
    })
    const childBeforeLoad = vi.fn<BeforeLoad>()
    const parentHead = vi.fn(() => ({ meta: [{ title: 'Parent' }] }))
    const childHead = vi.fn(() => ({ meta: [{ title: 'Child' }] }))

    const rootRoute = new BaseRootRoute({})
    const parentRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/parent',
      beforeLoad: parentBeforeLoad,
      head: parentHead,
    })
    const childRoute = new BaseRoute({
      getParentRoute: () => parentRoute,
      path: '/child',
      beforeLoad: childBeforeLoad,
      head: childHead,
    })

    const router = createTestRouter({
      routeTree: rootRoute.addChildren([parentRoute.addChildren([childRoute])]),
      history: createMemoryHistory(),
    })

    await router.preloadRoute({ to: '/parent/child' })

    expect(parentBeforeLoad).toHaveBeenCalledTimes(1)
    expect(childBeforeLoad).not.toHaveBeenCalled()
    expect(parentHead).toHaveBeenCalledTimes(1)
    expect(childHead).not.toHaveBeenCalled()
  })

  test('exec if pending preload (error)', async () => {
    const beforeLoad = vi.fn<BeforeLoad>(async ({ preload }) => {
      await sleep(100)
      if (preload) throw new Error('error')
    })
    const router = setup({
      beforeLoad,
    })
    router.preloadRoute({ to: '/foo' })
    await Promise.resolve()
    await router.navigate({ to: '/foo' })

    expect(beforeLoad).toHaveBeenCalledTimes(2)
  })
})

describe('loader skip or exec', () => {
  const setup = ({
    loader,
    staleTime,
    defaultStaleReloadMode,
  }: {
    loader?: Loader
    staleTime?: number
    defaultStaleReloadMode?: LoaderStaleReloadMode
  }) => {
    const rootRoute = new BaseRootRoute({})

    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
      loader,
      staleTime,
      gcTime: staleTime,
    })

    const barRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/bar',
    })

    const routeTree = rootRoute.addChildren([fooRoute, barRoute])

    const router = createTestRouter({
      routeTree,
      defaultStaleReloadMode,
      history: createMemoryHistory(),
    })

    return router
  }

  test('baseline', async () => {
    const loader = vi.fn()
    const router = setup({ loader })
    await router.load()
    expect(loader).toHaveBeenCalledTimes(0)
  })

  test('exec on regular nav', async () => {
    const loader = vi.fn(() => Promise.resolve({ hello: 'world' }))
    const router = setup({ loader })
    const navigation = router.navigate({ to: '/foo' })
    expect(loader).toHaveBeenCalledTimes(1)
    expect(router.stores.pendingMatches.get()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '/foo/foo' })]),
    )
    await navigation
    expect(router.state.location.pathname).toBe('/foo')
    expect(router.state.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '/foo/foo',
          loaderData: {
            hello: 'world',
          },
        }),
      ]),
    )
    expect(loader).toHaveBeenCalledTimes(1)
  })

  test('exec if resolved preload (success)', async () => {
    const loader = vi.fn()
    const router = setup({ loader })
    await router.preloadRoute({ to: '/foo' })
    expect(router.stores.cachedMatches.get()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '/foo/foo' })]),
    )
    await sleep(10)
    await router.navigate({ to: '/foo' })

    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('skip if resolved preload (success) within staleTime duration', async () => {
    const loader = vi.fn()
    const router = setup({ loader, staleTime: 1000 })
    await router.preloadRoute({ to: '/foo' })
    expect(router.stores.cachedMatches.get()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '/foo/foo' })]),
    )
    await sleep(10)
    await router.navigate({ to: '/foo' })

    expect(loader).toHaveBeenCalledTimes(1)
  })

  test('skip if pending preload (success)', async () => {
    const loader = vi.fn(() => sleep(100))
    const router = setup({ loader })
    router.preloadRoute({ to: '/foo' })
    await Promise.resolve()
    expect(router.stores.cachedMatches.get()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '/foo/foo' })]),
    )
    await router.navigate({ to: '/foo' })

    expect(loader).toHaveBeenCalledTimes(1)
  })

  test('exec if rejected preload (notFound)', async () => {
    const loader: Loader = vi.fn(async ({ preload }) => {
      if (preload) throw notFound()
      await Promise.resolve()
    })
    const router = setup({
      loader,
    })
    await router.preloadRoute({ to: '/foo' })
    await sleep(10)
    await router.navigate({ to: '/foo' })

    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('skip if pending preload (notFound)', async () => {
    const loader: Loader = vi.fn(async ({ preload }) => {
      await sleep(100)
      if (preload) throw notFound()
    })
    const router = setup({
      loader,
    })
    router.preloadRoute({ to: '/foo' })
    await Promise.resolve()
    await router.navigate({ to: '/foo' })

    expect(loader).toHaveBeenCalledTimes(1)
  })

  test('exec if rejected preload (redirect)', async () => {
    const loader: Loader = vi.fn(async ({ preload }) => {
      if (preload) throw redirect({ to: '/bar' })
      await Promise.resolve()
    })
    const router = setup({
      loader,
    })
    await router.preloadRoute({ to: '/foo' })
    expect(
      router.stores.cachedMatches.get().some((d) => d.status === 'redirected'),
    ).toBe(false)
    await sleep(10)
    await router.navigate({ to: '/foo' })

    expect(router.state.location.pathname).toBe('/foo')
    expect(
      router.stores.cachedMatches.get().some((d) => d.status === 'redirected'),
    ).toBe(false)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('skip if pending preload (redirect)', async () => {
    const loader: Loader = vi.fn(async ({ preload }) => {
      await sleep(100)
      if (preload) throw redirect({ to: '/bar' })
    })
    const router = setup({
      loader,
    })
    router.preloadRoute({ to: '/foo' })
    await Promise.resolve()
    expect(
      router.stores.cachedMatches.get().some((d) => d.status === 'redirected'),
    ).toBe(false)
    await router.navigate({ to: '/foo' })

    expect(router.state.location.pathname).toBe('/bar')
    expect(
      router.stores.cachedMatches.get().some((d) => d.status === 'redirected'),
    ).toBe(false)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  test('updateMatch removes redirected matches from cachedMatches', async () => {
    const loader = vi.fn()
    const router = setup({ loader })

    await router.preloadRoute({ to: '/foo' })
    expect(router.stores.cachedMatches.get()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: '/foo/foo' })]),
    )

    router.updateMatch('/foo/foo', (prev) => ({
      ...prev,
      status: 'redirected',
    }))

    expect(
      router.stores.cachedMatches.get().some((d) => d.id === '/foo/foo'),
    ).toBe(false)
    expect(
      router.stores.cachedMatches.get().some((d) => d.status === 'redirected'),
    ).toBe(false)
  })

  test('exec if rejected preload (error)', async () => {
    const loader: Loader = vi.fn(async ({ preload }) => {
      if (preload) throw new Error('error')
      await Promise.resolve()
    })
    const router = setup({
      loader,
    })
    await router.preloadRoute({ to: '/foo' })
    await sleep(10)
    await router.navigate({ to: '/foo' })

    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('skip if pending preload (error)', async () => {
    const loader: Loader = vi.fn(async ({ preload }) => {
      await sleep(100)
      if (preload) throw new Error('error')
    })
    const router = setup({
      loader,
    })
    router.preloadRoute({ to: '/foo' })
    await Promise.resolve()
    await router.navigate({ to: '/foo' })

    expect(loader).toHaveBeenCalledTimes(1)
  })
})

test('exec on stay (beforeLoad & loader)', async () => {
  let rootBeforeLoadResolved = false
  const rootBeforeLoad = vi.fn(async () => {
    await sleep(10)
    rootBeforeLoadResolved = true
  })
  const rootLoader = vi.fn(() => sleep(10))
  const rootRoute = new BaseRootRoute({
    beforeLoad: rootBeforeLoad,
    loader: rootLoader,
  })

  let layoutBeforeLoadResolved = false
  const layoutBeforeLoad = vi.fn(async () => {
    await sleep(10)
    layoutBeforeLoadResolved = true
  })
  const layoutLoader = vi.fn(() => sleep(10))
  const layoutRoute = new BaseRoute({
    getParentRoute: () => rootRoute,
    beforeLoad: layoutBeforeLoad,
    loader: layoutLoader,
    id: '/_layout',
  })

  const fooRoute = new BaseRoute({
    getParentRoute: () => layoutRoute,
    path: '/foo',
  })
  const barRoute = new BaseRoute({
    getParentRoute: () => layoutRoute,
    path: '/bar',
  })

  const routeTree = rootRoute.addChildren([
    layoutRoute.addChildren([fooRoute, barRoute]),
  ])

  const router = createTestRouter({
    routeTree,
    history: createMemoryHistory(),
    defaultStaleTime: 1000,
    defaultGcTime: 1000,
  })

  await router.navigate({ to: '/foo' })
  expect(router.state.location.pathname).toBe('/foo')

  rootBeforeLoadResolved = false
  layoutBeforeLoadResolved = false
  vi.clearAllMocks()

  /*
   * When navigating between sibling routes,
   * do the parent routes get re-executed?
   */

  await router.navigate({ to: '/bar' })
  expect(router.state.location.pathname).toBe('/bar')

  // beforeLoads always re-execute
  expect(rootBeforeLoad).toHaveBeenCalledTimes(1)
  expect(layoutBeforeLoad).toHaveBeenCalledTimes(1)

  // beforeLoads are called in order
  expect(rootBeforeLoad.mock.invocationCallOrder[0]).toBeLessThan(
    layoutBeforeLoad.mock.invocationCallOrder[0]!,
  )

  // loaders are skipped because of staleTime
  expect(rootLoader).toHaveBeenCalledTimes(0)
  expect(layoutLoader).toHaveBeenCalledTimes(0)

  // beforeLoad calls were correctly awaited
  expect(rootBeforeLoadResolved).toBe(true)
  expect(layoutBeforeLoadResolved).toBe(true)
})

describe('stale loader reload triggers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const getMatchById = (
    router: RouterCore<any, any, any, any, any>,
    id: string,
  ) =>
    router.state.matches.find((match) => match.id === id) ??
    router.stores.pendingMatches.get().find((match) => match.id === id) ??
    router.stores.cachedMatches.get().find((match) => match.id === id)

  const hasActiveMatch = (
    router: RouterCore<any, any, any, any, any>,
    id: string,
  ) => router.state.matches.some((match) => match.id === id)

  const hasPendingMatch = (
    router: RouterCore<any, any, any, any, any>,
    id: string,
  ) =>
    router.stores.pendingMatches.get().some((match) => match.id === id) ?? false

  const setup = ({
    loader,
    staleTime,
    defaultStaleReloadMode,
  }: {
    loader?: Loader
    staleTime?: number
    defaultStaleReloadMode?: LoaderStaleReloadMode
  }) => {
    const rootRoute = new BaseRootRoute({})

    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
      loader,
      staleTime,
      gcTime: 60_000,
    })

    const barRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/bar',
    })

    const routeTree = rootRoute.addChildren([fooRoute, barRoute])

    return createTestRouter({
      routeTree,
      defaultStaleReloadMode,
      history: createMemoryHistory(),
    })
  }

  const createControlledStaleReload = () => {
    let resolveStaleReload: (() => void) | undefined
    let callCount = 0

    const loader = vi.fn(() => {
      callCount += 1
      if (callCount === 1) {
        return { value: 'first' }
      }

      return new Promise<{ value: string }>((resolve) => {
        resolveStaleReload = () => resolve({ value: 'second' })
      })
    })

    return {
      loader,
      resolveStaleReload: () => resolveStaleReload?.(),
    }
  }

  const expectBlockingStaleReloadBehavior = async (
    router: RouterCore<any, any, any, any, any>,
    loader: ReturnType<typeof vi.fn>,
    resolveStaleReload: () => void,
  ) => {
    await router.navigate({ to: '/foo' })
    expect(loader).toHaveBeenCalledTimes(1)
    expect(getMatchById(router, '/foo/foo')?.loaderData).toEqual({
      value: 'first',
    })

    await vi.advanceTimersByTimeAsync(1)
    await router.navigate({ to: '/bar' })
    await vi.advanceTimersByTimeAsync(1)

    const revisit = router.navigate({ to: '/foo' })
    await Promise.resolve()

    expect(loader).toHaveBeenCalledTimes(2)
    expect(hasActiveMatch(router, '/bar/bar')).toBe(true)
    expect(hasActiveMatch(router, '/foo/foo')).toBe(false)
    expect(hasPendingMatch(router, '/foo/foo')).toBe(true)
    expect(getMatchById(router, '/foo/foo')?.loaderData).toEqual({
      value: 'first',
    })

    resolveStaleReload()
    await revisit

    expect(loader).toHaveBeenCalledTimes(2)
    expect(hasActiveMatch(router, '/foo/foo')).toBe(true)
    expect(hasPendingMatch(router, '/foo/foo')).toBe(false)
    expect(router.state.location.pathname).toBe('/foo')
    expect(getMatchById(router, '/foo/foo')?.loaderData).toEqual({
      value: 'second',
    })
  }

  const expectBackgroundStaleReloadBehavior = async (
    router: RouterCore<any, any, any, any, any>,
    loader: ReturnType<typeof vi.fn>,
    resolveStaleReload: () => void,
  ) => {
    await router.navigate({ to: '/foo' })
    expect(loader).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await router.navigate({ to: '/bar' })
    await vi.advanceTimersByTimeAsync(1)

    const revisit = router.navigate({ to: '/foo' })

    expect(loader).toHaveBeenCalledTimes(2)

    await revisit
    const backgroundReloadPromise = getMatchById(router, '/foo/foo')
      ?._nonReactive.loaderPromise

    expect(backgroundReloadPromise).toBeDefined()
    expect(hasActiveMatch(router, '/foo/foo')).toBe(true)
    expect(hasPendingMatch(router, '/foo/foo')).toBe(false)
    expect(router.state.location.pathname).toBe('/foo')
    expect(getMatchById(router, '/foo/foo')?.loaderData).toEqual({
      value: 'first',
    })

    resolveStaleReload()
    await backgroundReloadPromise

    expect(getMatchById(router, '/foo/foo')?.loaderData).toEqual({
      value: 'second',
    })
  }

  test('skips stale loader when only unrelated search params change', async () => {
    const rootRoute = new BaseRootRoute({})
    const loader = vi.fn(() => ({ ok: true }))

    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
      loader,
      staleTime: 0,
      gcTime: 0,
      loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
        page: search['page'],
      }),
    })

    const routeTree = rootRoute.addChildren([fooRoute])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.navigate({ to: '/foo', search: { page: '1', filter: 'a' } })
    expect(loader).toHaveBeenCalledTimes(1)

    await router.navigate({ to: '/foo', search: { page: '1', filter: 'b' } })

    expect(loader).toHaveBeenCalledTimes(1)
  })

  test('reloads stale loader when loader deps change', async () => {
    const rootRoute = new BaseRootRoute({})
    const loader = vi.fn(() => ({ ok: true }))

    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
      loader,
      staleTime: 0,
      gcTime: 0,
      loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
        page: search['page'],
      }),
    })

    const routeTree = rootRoute.addChildren([fooRoute])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.navigate({ to: '/foo', search: { page: '1' } })
    expect(loader).toHaveBeenCalledTimes(1)

    await router.navigate({ to: '/foo', search: { page: '2' } })

    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('reloads a stale preloaded loader when switching to a different match id of the same route', async () => {
    const rootRoute = new BaseRootRoute({})
    const rootLoader = vi.fn(() => ({ ok: true }))
    const childLoader = vi.fn(() => ({ ok: true }))

    const rootChildRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts',
      loader: rootLoader,
      staleTime: 0,
      gcTime: 0,
      loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
        page: search['page'],
      }),
    })

    const leafRoute = new BaseRoute({
      getParentRoute: () => rootChildRoute,
      path: '/$postId',
      loader: childLoader,
      staleTime: 0,
      gcTime: 0,
    })

    const routeTree = rootRoute.addChildren([
      rootChildRoute.addChildren([leafRoute]),
    ])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.navigate({
      to: '/posts/$postId',
      params: { postId: '1' },
      search: { page: '1' },
    })

    expect(rootLoader).toHaveBeenCalledTimes(1)
    expect(childLoader).toHaveBeenCalledTimes(1)

    await router.preloadRoute({
      to: '/posts/$postId',
      params: { postId: '2' },
      search: { page: '2' },
    })

    expect(rootLoader).toHaveBeenCalledTimes(2)
    expect(childLoader).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1)

    await router.navigate({
      to: '/posts/$postId',
      params: { postId: '2' },
      search: { page: '2' },
    })

    expect(rootLoader).toHaveBeenCalledTimes(3)
    expect(childLoader).toHaveBeenCalledTimes(3)
  })

  test('skips stale ancestor loader when only a child path param changes', async () => {
    const rootRoute = new BaseRootRoute({})
    const parentLoader = vi.fn(() => ({ ok: true }))
    const childLoader = vi.fn(() => ({ ok: true }))

    const orgRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/orgs/$orgId',
      loader: parentLoader,
      staleTime: 0,
      gcTime: 0,
    })

    const userRoute = new BaseRoute({
      getParentRoute: () => orgRoute,
      path: '/users/$userId',
      loader: childLoader,
      staleTime: 0,
      gcTime: 0,
    })

    const routeTree = rootRoute.addChildren([orgRoute.addChildren([userRoute])])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.navigate({
      to: '/orgs/$orgId/users/$userId',
      params: { orgId: 'acme', userId: 'u1' },
    })
    expect(parentLoader).toHaveBeenCalledTimes(1)
    expect(childLoader).toHaveBeenCalledTimes(1)

    await router.navigate({
      to: '/orgs/$orgId/users/$userId',
      params: { orgId: 'acme', userId: 'u2' },
    })

    expect(parentLoader).toHaveBeenCalledTimes(1)
    expect(childLoader).toHaveBeenCalledTimes(2)
  })

  test('reloads stale ancestor loader when its own path param changes', async () => {
    const rootRoute = new BaseRootRoute({})
    const parentLoader = vi.fn(() => ({ ok: true }))
    const childLoader = vi.fn(() => ({ ok: true }))

    const orgRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/orgs/$orgId',
      loader: parentLoader,
      staleTime: 0,
      gcTime: 0,
    })

    const userRoute = new BaseRoute({
      getParentRoute: () => orgRoute,
      path: '/users/$userId',
      loader: childLoader,
      staleTime: 0,
      gcTime: 0,
    })

    const routeTree = rootRoute.addChildren([orgRoute.addChildren([userRoute])])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.navigate({
      to: '/orgs/$orgId/users/$userId',
      params: { orgId: 'acme', userId: 'u1' },
    })
    expect(parentLoader).toHaveBeenCalledTimes(1)
    expect(childLoader).toHaveBeenCalledTimes(1)

    await router.navigate({
      to: '/orgs/$orgId/users/$userId',
      params: { orgId: 'beta', userId: 'u2' },
    })

    expect(parentLoader).toHaveBeenCalledTimes(2)
    expect(childLoader).toHaveBeenCalledTimes(2)
  })

  test('revalidates stale loaders on explicit same-location router.load()', async () => {
    const rootRoute = new BaseRootRoute({})
    const loader = vi.fn(() => ({ ok: true }))

    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
      loader,
      staleTime: 0,
      gcTime: 0,
      loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
        page: search['page'],
      }),
    })

    const routeTree = rootRoute.addChildren([fooRoute])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.navigate({ to: '/foo', search: { page: '1', filter: 'a' } })
    expect(loader).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await router.load()
    await Promise.resolve()

    expect(loader).toHaveBeenCalledTimes(2)
  })

  test('supports object-form loader handler', async () => {
    const handler = vi.fn(() => ({ ok: true }))
    const router = setup({
      loader: {
        handler,
      } satisfies LoaderEntry,
    })

    await router.navigate({ to: '/foo' })

    expect(handler).toHaveBeenCalledTimes(1)
    expect(router.state.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: '/foo/foo',
          loaderData: { ok: true },
        }),
      ]),
    )
  })

  test('reloads stale loaders in the background by default', async () => {
    const { loader, resolveStaleReload } = createControlledStaleReload()
    const router = setup({ loader, staleTime: 0 })

    await expectBackgroundStaleReloadBehavior(
      router,
      loader,
      resolveStaleReload,
    )
  })

  test('blocks stale reloads when loader staleReloadMode is blocking', async () => {
    const { loader, resolveStaleReload } = createControlledStaleReload()
    const router = setup({
      staleTime: 0,
      loader: {
        handler: loader,
        staleReloadMode: 'blocking',
      } satisfies LoaderEntry,
    })

    await expectBlockingStaleReloadBehavior(router, loader, resolveStaleReload)
  })

  test('blocks stale reloads when defaultStaleReloadMode is blocking', async () => {
    const { loader, resolveStaleReload } = createControlledStaleReload()
    const router = setup({
      loader,
      staleTime: 0,
      defaultStaleReloadMode: 'blocking',
    })

    await expectBlockingStaleReloadBehavior(router, loader, resolveStaleReload)
  })

  test('loader staleReloadMode overrides defaultStaleReloadMode', async () => {
    const { loader, resolveStaleReload } = createControlledStaleReload()
    const router = setup({
      staleTime: 0,
      defaultStaleReloadMode: 'blocking',
      loader: {
        handler: loader,
        staleReloadMode: 'background',
      } satisfies LoaderEntry,
    })

    await expectBackgroundStaleReloadBehavior(
      router,
      loader,
      resolveStaleReload,
    )
  })
})

test('cancelMatches after pending timeout', async () => {
  const WAIT_TIME = 5
  const onAbortMock = vi.fn()
  const rootRoute = new BaseRootRoute({})
  const fooRoute = new BaseRoute({
    getParentRoute: () => rootRoute,
    path: '/foo',
    pendingMs: WAIT_TIME * 20,
    loader: async ({ abortController }) => {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          resolve()
        }, WAIT_TIME * 40)
        abortController.signal.addEventListener('abort', () => {
          onAbortMock()
          clearTimeout(timer)
          resolve()
        })
      })
    },
    pendingComponent: {},
  })
  const barRoute = new BaseRoute({
    getParentRoute: () => rootRoute,
    path: '/bar',
  })
  const routeTree = rootRoute.addChildren([fooRoute, barRoute])
  const router = createTestRouter({ routeTree, history: createMemoryHistory() })

  await router.load()
  router.navigate({ to: '/foo' })
  await sleep(WAIT_TIME * 30)

  // At this point, pending timeout should have triggered
  const fooMatch = router.getMatch('/foo/foo')
  expect(fooMatch).toBeDefined()

  // Navigate away, which should cancel the pending match
  await router.navigate({ to: '/bar' })
  await router.latestLoadPromise

  expect(router.state.location.pathname).toBe('/bar')

  // Verify that abort was called and pending timeout was cleared
  expect(onAbortMock).toHaveBeenCalled()
  const cancelledFooMatch = router.getMatch('/foo/foo')
  expect(cancelledFooMatch?._nonReactive.pendingTimeout).toBeUndefined()
})

describe('head execution', () => {
  const setupBeforeLoadNotFoundHierarchy = (throwAtIndex: 1 | 2 | 3) => {
    const loaderResolvers: Array<(() => void) | undefined> = []

    const makeLoader = (index: number) =>
      vi.fn(async () => {
        await new Promise<void>((resolve) => {
          loaderResolvers[index] = resolve
        })
        return { level: index }
      })

    const makeHead = (label: string) =>
      vi.fn(() => ({ meta: [{ title: label }] }))

    const rootRoute = new BaseRootRoute({
      loader: makeLoader(0),
      head: makeHead('Root'),
    })

    const level1Route = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/level-1',
      loader: makeLoader(1),
      head: makeHead('Level 1'),
      beforeLoad:
        throwAtIndex === 1
          ? () => {
              throw notFound()
            }
          : undefined,
    })

    const level2Route = new BaseRoute({
      getParentRoute: () => level1Route,
      path: '/level-2',
      loader: makeLoader(2),
      head: makeHead('Level 2'),
      beforeLoad:
        throwAtIndex === 2
          ? () => {
              throw notFound()
            }
          : undefined,
    })

    const level3Route = new BaseRoute({
      getParentRoute: () => level2Route,
      path: '/level-3',
      loader: makeLoader(3),
      head: makeHead('Level 3'),
      beforeLoad:
        throwAtIndex === 3
          ? () => {
              throw notFound()
            }
          : undefined,
    })

    const routeTree = rootRoute.addChildren([
      level1Route.addChildren([level2Route.addChildren([level3Route])]),
    ])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({
        initialEntries: ['/level-1/level-2/level-3'],
      }),
    })

    const routes = [rootRoute, level1Route, level2Route, level3Route] as const
    const loaders = routes.map(
      (route) => route.options.loader as ReturnType<typeof makeLoader>,
    )
    const heads = routes.map(
      (route) => route.options.head as ReturnType<typeof makeHead>,
    )

    return {
      router,
      routes,
      loaders,
      heads,
      loaderResolvers,
      throwAtIndex,
    }
  }

  const assertBeforeLoadNotFoundHierarchy = async (throwAtIndex: 1 | 2 | 3) => {
    const { router, routes, loaders, heads, loaderResolvers } =
      setupBeforeLoadNotFoundHierarchy(throwAtIndex)

    let loadResolved = false
    const loadPromise = router.load().then(() => {
      loadResolved = true
    })

    await Promise.resolve()
    await Promise.resolve()

    for (let i = 0; i < routes.length; i++) {
      const loader = loaders[i]!
      const expectedCalls = i < throwAtIndex ? 1 : 0
      expect(loader).toHaveBeenCalledTimes(expectedCalls)
    }

    expect(loadResolved).toBe(false)

    for (let i = 0; i < throwAtIndex; i++) {
      expect(loaderResolvers[i]).toBeDefined()
      loaderResolvers[i]!()
    }

    await loadPromise

    for (let i = 0; i < heads.length; i++) {
      const head = heads[i]!
      const expectedCalls = i <= throwAtIndex ? 1 : 0
      expect(head).toHaveBeenCalledTimes(expectedCalls)
    }

    for (let i = 0; i < throwAtIndex; i++) {
      const route = routes[i]!
      const match = router.state.matches.find((m) => m.routeId === route.id)
      expect(match?.loaderData).toEqual({ level: i })
    }

    const thrownRoute = routes[throwAtIndex]!
    const thrownMatch = router.state.matches.find(
      (m) => m.routeId === thrownRoute.id,
    )
    expect(thrownMatch?.status).toBe('notFound')
  }

  ;([1, 2, 3] as const).forEach((throwAtIndex) => {
    test(`beforeLoad notFound at hierarchy level ${throwAtIndex} waits for parent loader data and executes heads`, async () => {
      await assertBeforeLoadNotFoundHierarchy(throwAtIndex)
    })
  })

  test('executes head once when loader throws notFound', async () => {
    const head = vi.fn(() => ({ meta: [{ title: 'Test' }] }))
    const rootRoute = new BaseRootRoute({})
    const testRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/test',
      loader: () => {
        throw notFound()
      },
      head,
    })
    const routeTree = rootRoute.addChildren([testRoute])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/test'] }),
    })

    await router.load()

    expect(head).toHaveBeenCalledTimes(1)
    const match = router.state.matches.find((m) => m.routeId === testRoute.id)
    expect(match?.status).toBe('notFound')
  })

  test('propagates sync beforeLoad non-notFound error running ancestor loaders and heads', async () => {
    const beforeLoadError = new Error('beforeLoad-sync-error')
    const rootLoader = vi.fn(() => ({ level: 0 }))
    const rootHead = vi.fn(() => ({ meta: [{ title: 'Root' }] }))

    const rootRoute = new BaseRootRoute({
      loader: rootLoader,
      head: rootHead,
    })

    const childLoader = vi.fn(() => ({ level: 1 }))
    const childHead = vi.fn(() => ({ meta: [{ title: 'Child' }] }))

    const childRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/test',
      beforeLoad: () => {
        throw beforeLoadError
      },
      loader: childLoader,
      head: childHead,
    })

    const routeTree = rootRoute.addChildren([childRoute])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/test'] }),
    })

    const location = router.latestLocation
    const matches = router.matchRoutes(location)
    router.stores.setPending(matches)

    await expect(
      loadMatches({
        router,
        location,
        matches,
        updateMatch: router.updateMatch,
      }),
    ).rejects.toBe(beforeLoadError)

    expect(rootLoader).toHaveBeenCalledTimes(1)
    expect(childLoader).toHaveBeenCalledTimes(0)
    // Head functions still run for ancestors up to the erroring match so that
    // SSR produces valid <head> content (e.g. charset, viewport, stylesheets).
    expect(rootHead).toHaveBeenCalledTimes(1)
    expect(childHead).toHaveBeenCalledTimes(1)
  })

  test('propagates async beforeLoad non-notFound error running ancestor loaders and heads', async () => {
    const beforeLoadError = new Error('beforeLoad-async-error')
    const rootLoader = vi.fn(() => ({ level: 0 }))
    const rootHead = vi.fn(() => ({ meta: [{ title: 'Root' }] }))

    const rootRoute = new BaseRootRoute({
      loader: rootLoader,
      head: rootHead,
    })

    const childLoader = vi.fn(() => ({ level: 1 }))
    const childHead = vi.fn(() => ({ meta: [{ title: 'Child' }] }))

    const childRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/test',
      beforeLoad: async () => {
        await Promise.resolve()
        throw beforeLoadError
      },
      loader: childLoader,
      head: childHead,
    })

    const routeTree = rootRoute.addChildren([childRoute])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/test'] }),
    })

    const location = router.latestLocation
    const matches = router.matchRoutes(location)
    router.stores.setPending(matches)

    await expect(
      loadMatches({
        router,
        location,
        matches,
        updateMatch: router.updateMatch,
      }),
    ).rejects.toBe(beforeLoadError)

    expect(rootLoader).toHaveBeenCalledTimes(1)
    expect(childLoader).toHaveBeenCalledTimes(0)
    // Head functions still run for ancestors up to the erroring match so that
    // SSR produces valid <head> content (e.g. charset, viewport, stylesheets).
    expect(rootHead).toHaveBeenCalledTimes(1)
    expect(childHead).toHaveBeenCalledTimes(1)
  })

  describe('beforeLoad notFound parent loader outcomes', () => {
    type ThrowAtIndex = 1 | 2 | 3
    type ParentFailure = 'notFound' | 'redirect' | 'error'
    type ParentFailureMap = Partial<Record<0 | 1 | 2, ParentFailure>>
    type Scenario = {
      name: string
      throwAtIndex: ThrowAtIndex
      parentFailures: ParentFailureMap
      expectedErrorKind: 'notFound' | 'redirect' | 'error'
      expectedErrorSource?: string
      expectedErrorRouteIndex?: 0 | 1 | 2 | 3
      expectedLoaderMaxIndex: number
      expectedRenderedHeadMaxIndex: number
      withDefaultNotFoundComponent?: boolean
      beforeLoadNotFoundFactory?: (
        routes: readonly [any, any, any, any],
      ) => ReturnType<typeof notFound>
      expectRootNotFoundComponentAssigned?: boolean
    }

    const setupScenario = ({
      throwAtIndex,
      parentFailures,
      beforeLoadNotFoundFactory,
      withDefaultNotFoundComponent,
    }: {
      throwAtIndex: ThrowAtIndex
      parentFailures: ParentFailureMap
      beforeLoadNotFoundFactory?: Scenario['beforeLoadNotFoundFactory']
      withDefaultNotFoundComponent?: boolean
    }) => {
      const makeHead = (label: string) =>
        vi.fn(() => ({ meta: [{ title: label }] }))

      const makeLoader = (index: number) =>
        vi.fn(() => {
          const failure = parentFailures[index as 0 | 1 | 2]
          if (failure === 'notFound') {
            throw notFound({ data: { source: `loader-${index}` } })
          }
          if (failure === 'redirect') {
            throw redirect({ to: '/redirect-target' })
          }
          return { level: index }
        })

      const rootRoute = new BaseRootRoute({
        loader: makeLoader(0),
        head: makeHead('Root'),
      })

      const level1Route = new BaseRoute({
        getParentRoute: () => rootRoute,
        path: '/level-1',
        loader: makeLoader(1),
        head: makeHead('Level 1'),
      })

      const level2Route = new BaseRoute({
        getParentRoute: () => level1Route,
        path: '/level-2',
        loader: makeLoader(2),
        head: makeHead('Level 2'),
      })

      const level3Route = new BaseRoute({
        getParentRoute: () => level2Route,
        path: '/level-3',
        loader: makeLoader(3),
        head: makeHead('Level 3'),
      })

      const redirectTargetRoute = new BaseRoute({
        getParentRoute: () => rootRoute,
        path: '/redirect-target',
      })

      const routeTree = rootRoute.addChildren([
        level1Route.addChildren([level2Route.addChildren([level3Route])]),
        redirectTargetRoute,
      ])

      const routes = [rootRoute, level1Route, level2Route, level3Route] as const

      ;([0, 1, 2] as const).forEach((index) => {
        if (parentFailures[index] === 'error') {
          ;(routes[index].options as any).shouldReload = () => {
            throw new Error(`loader-${index}-error`)
          }
        }
      })

      const throwRoute = routes[throwAtIndex]!
      throwRoute.options.beforeLoad = () => {
        const beforeLoadNotFound = beforeLoadNotFoundFactory
          ? beforeLoadNotFoundFactory(routes)
          : notFound({ data: { source: `beforeLoad-${throwAtIndex}` } })
        throw beforeLoadNotFound
      }

      const router = createTestRouter({
        routeTree,
        history: createMemoryHistory({
          initialEntries: ['/level-1/level-2/level-3'],
        }),
        ...(withDefaultNotFoundComponent
          ? { defaultNotFoundComponent: () => null }
          : {}),
      })

      const loaders = routes.map(
        (route) => route.options.loader as ReturnType<typeof makeLoader>,
      )
      const heads = routes.map(
        (route) => route.options.head as ReturnType<typeof makeHead>,
      )

      return {
        router,
        routes,
        loaders,
        heads,
      }
    }

    const runLoadMatchesAndCapture = async (router: AnyRouter) => {
      const location = router.latestLocation
      const matches = router.matchRoutes(location)
      router.stores.setPending(matches)

      try {
        await loadMatches({
          router,
          location,
          matches,
          updateMatch: router.updateMatch,
        })
        return { error: undefined, matches }
      } catch (error) {
        return { error, matches }
      }
    }

    const scenarios = [
      {
        name: 'throws beforeLoad notFound when parent loaders succeed',
        throwAtIndex: 3 as const,
        parentFailures: {} as ParentFailureMap,
        expectedErrorKind: 'notFound' as const,
        expectedErrorSource: 'beforeLoad-3',
        expectedLoaderMaxIndex: 2,
        expectedRenderedHeadMaxIndex: 3,
      },
      {
        name: 'uses parent loader notFound when parent loader throws notFound',
        throwAtIndex: 3 as const,
        parentFailures: { 1: 'notFound' } as ParentFailureMap,
        expectedErrorKind: 'notFound' as const,
        expectedErrorSource: 'loader-1',
        expectedLoaderMaxIndex: 2,
        expectedRenderedHeadMaxIndex: 1,
      },
      {
        name: 'uses first parent loader notFound when multiple parent loaders throw notFound',
        throwAtIndex: 3 as const,
        parentFailures: { 1: 'notFound', 2: 'notFound' } as ParentFailureMap,
        expectedErrorKind: 'notFound' as const,
        expectedErrorSource: 'loader-1',
        expectedLoaderMaxIndex: 2,
        expectedRenderedHeadMaxIndex: 1,
      },
      {
        name: 'uses parent loader notFound when root loader throws notFound',
        throwAtIndex: 2 as const,
        parentFailures: { 0: 'notFound' } as ParentFailureMap,
        expectedErrorKind: 'notFound' as const,
        expectedErrorSource: 'loader-0',
        expectedLoaderMaxIndex: 1,
        expectedRenderedHeadMaxIndex: 0,
      },
      {
        name: 'uses explicit routeId from beforeLoad notFound to target ancestor boundary',
        throwAtIndex: 3 as const,
        parentFailures: {} as ParentFailureMap,
        expectedErrorKind: 'notFound' as const,
        expectedErrorSource: 'beforeLoad-explicit-level1',
        expectedErrorRouteIndex: 1,
        expectedLoaderMaxIndex: 1,
        expectedRenderedHeadMaxIndex: 1,
        beforeLoadNotFoundFactory: (routes) =>
          notFound({
            routeId: routes[1].id as never,
            data: { source: 'beforeLoad-explicit-level1' },
          }),
      },
      {
        name: 'falls back to root boundary when beforeLoad notFound uses unknown routeId',
        throwAtIndex: 3 as const,
        parentFailures: {} as ParentFailureMap,
        expectedErrorKind: 'notFound' as const,
        expectedErrorSource: 'beforeLoad-invalid-route',
        expectedLoaderMaxIndex: 0,
        expectedRenderedHeadMaxIndex: 0,
        beforeLoadNotFoundFactory: () =>
          notFound({
            routeId: '/does-not-exist' as never,
            data: { source: 'beforeLoad-invalid-route' },
          }),
      },
      {
        name: 'falls back to root boundary when beforeLoad notFound uses non-exact routeId',
        throwAtIndex: 3 as const,
        parentFailures: {} as ParentFailureMap,
        expectedErrorKind: 'notFound' as const,
        expectedErrorSource: 'beforeLoad-non-exact-route',
        expectedLoaderMaxIndex: 0,
        expectedRenderedHeadMaxIndex: 0,
        beforeLoadNotFoundFactory: (routes) =>
          notFound({
            routeId: `${routes[1].id}/` as never,
            data: { source: 'beforeLoad-non-exact-route' },
          }),
      },
      {
        name: 'assigns defaultNotFoundComponent on root when unknown routeId falls back to root',
        throwAtIndex: 3 as const,
        parentFailures: {} as ParentFailureMap,
        expectedErrorKind: 'notFound' as const,
        expectedErrorSource: 'beforeLoad-invalid-route-default',
        expectedLoaderMaxIndex: 0,
        expectedRenderedHeadMaxIndex: 0,
        withDefaultNotFoundComponent: true,
        expectRootNotFoundComponentAssigned: true,
        beforeLoadNotFoundFactory: () =>
          notFound({
            routeId: '/does-not-exist' as never,
            data: { source: 'beforeLoad-invalid-route-default' },
          }),
      },
      {
        name: 'prioritizes redirect when parent loader throws redirect',
        throwAtIndex: 3 as const,
        parentFailures: { 0: 'redirect' } as ParentFailureMap,
        expectedErrorKind: 'redirect' as const,
        expectedErrorSource: undefined,
        expectedLoaderMaxIndex: 2,
        expectedRenderedHeadMaxIndex: -1,
      },
      {
        name: 'prioritizes redirect over root-loader notFound when both appear in settled loaders',
        throwAtIndex: 3 as const,
        parentFailures: { 0: 'notFound', 1: 'redirect' } as ParentFailureMap,
        expectedErrorKind: 'redirect' as const,
        expectedErrorSource: undefined,
        expectedLoaderMaxIndex: 2,
        expectedRenderedHeadMaxIndex: -1,
      },
      {
        name: 'propagates regular loader error when mixed with loader notFound in settled loaders',
        throwAtIndex: 3 as const,
        parentFailures: { 1: 'notFound', 2: 'error' } as ParentFailureMap,
        expectedErrorKind: 'error' as const,
        expectedErrorSource: 'loader-2-error',
        expectedLoaderMaxIndex: 1,
        expectedRenderedHeadMaxIndex: -1,
      },
    ] satisfies Array<Scenario>

    test.each(scenarios)('$name', async (scenario) => {
      const { router, routes, loaders, heads } = setupScenario({
        throwAtIndex: scenario.throwAtIndex,
        parentFailures: scenario.parentFailures,
        beforeLoadNotFoundFactory: scenario.beforeLoadNotFoundFactory,
        withDefaultNotFoundComponent: scenario.withDefaultNotFoundComponent,
      })

      const { error, matches } = await runLoadMatchesAndCapture(router)

      for (let i = 0; i < routes.length; i++) {
        const loader = loaders[i]!
        const expectedCalls = i <= scenario.expectedLoaderMaxIndex ? 1 : 0
        expect(loader).toHaveBeenCalledTimes(expectedCalls)
      }

      for (let i = 0; i < heads.length; i++) {
        const head = heads[i]!
        const expectedCalls = i <= scenario.expectedRenderedHeadMaxIndex ? 1 : 0
        expect(head).toHaveBeenCalledTimes(expectedCalls)
      }

      if (scenario.expectedErrorKind === 'redirect') {
        expect(error).toEqual(
          expect.objectContaining({
            redirectHandled: true,
            options: expect.objectContaining({
              to: '/redirect-target',
            }),
          }),
        )
        return
      }

      if (scenario.expectedErrorKind === 'error') {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toBe(scenario.expectedErrorSource)
        return
      }

      expect(error).toEqual(
        expect.objectContaining({
          isNotFound: true,
          data: { source: scenario.expectedErrorSource },
        }),
      )

      if (scenario.expectedErrorRouteIndex !== undefined) {
        expect((error as { routeId?: string }).routeId).toBe(
          routes[scenario.expectedErrorRouteIndex]!.id,
        )
      }

      if (scenario.expectRootNotFoundComponentAssigned) {
        expect(routes[0].options.notFoundComponent).toBeTypeOf('function')
      }
    })

    test('sets globalNotFound on root match when beforeLoad notFound targets root boundary', async () => {
      const { router, routes } = setupScenario({
        throwAtIndex: 3,
        parentFailures: {},
        beforeLoadNotFoundFactory: (innerRoutes) =>
          notFound({
            routeId: innerRoutes[0].id as never,
            data: { source: 'beforeLoad-root-explicit' },
          }),
      })

      const { error, matches } = await runLoadMatchesAndCapture(router)

      expect(error).toEqual(
        expect.objectContaining({
          isNotFound: true,
          data: { source: 'beforeLoad-root-explicit' },
        }),
      )

      const rootMatch = router.stores.pendingMatches
        .get()
        .find((m) => m.routeId === routes[0].id)

      expect(rootMatch?.globalNotFound).toBe(true)
      expect(rootMatch?.status).toBe('success')
      expect(rootMatch?.error).toBeUndefined()
    })

    test('clears stale root globalNotFound on subsequent successful load', async () => {
      const { router, routes } = setupScenario({
        throwAtIndex: 3,
        parentFailures: {},
        beforeLoadNotFoundFactory: (innerRoutes) =>
          notFound({
            routeId: innerRoutes[0].id as never,
            data: { source: 'beforeLoad-root-explicit' },
          }),
      })

      const first = await runLoadMatchesAndCapture(router)
      expect(first.error).toEqual(expect.objectContaining({ isNotFound: true }))

      const throwingRoute = routes[3]
      throwingRoute.options.beforeLoad = undefined

      const second = await runLoadMatchesAndCapture(router)
      expect(second.error).toBeUndefined()

      const rootMatch = router.stores.pendingMatches
        .get()
        .find((m) => m.routeId === routes[0].id)

      expect(rootMatch?.globalNotFound).toBe(false)
    })

    test('clears stale root globalNotFound when root loader is skipped', async () => {
      const rootLoader = vi.fn(() => ({ level: 0 }))
      const rootRoute = new BaseRootRoute({
        loader: rootLoader,
        staleTime: Infinity,
        shouldReload: () => false,
      })

      const childLoader = vi.fn(() => ({ level: 1 }))
      const childRoute = new BaseRoute({
        getParentRoute: () => rootRoute,
        path: '/test',
        loader: childLoader,
        staleTime: Infinity,
        shouldReload: () => false,
      })

      const routeTree = rootRoute.addChildren([childRoute])

      const router = createTestRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: ['/test'] }),
      })

      const first = await runLoadMatchesAndCapture(router)
      expect(first.error).toBeUndefined()
      expect(rootLoader).toHaveBeenCalledTimes(1)

      const staleRootNotFound = notFound({ data: { source: 'stale-root' } })
      const currentRootMatchId = router.stores.pendingMatches
        .get()
        .find((m) => m.routeId === rootRoute.id)!.id

      router.updateMatch(currentRootMatchId, (prev) => ({
        ...prev,
        status: 'success',
        globalNotFound: true,
        error: staleRootNotFound,
      }))

      const location = router.latestLocation
      const matches = router.matchRoutes(location)
      const pendingRootMatch = matches.find((m) => m.routeId === rootRoute.id)!
      pendingRootMatch.status = 'success'
      pendingRootMatch.globalNotFound = false
      pendingRootMatch.error = undefined
      router.stores.setPending(matches)

      await expect(
        loadMatches({
          router,
          location,
          matches,
          updateMatch: router.updateMatch,
        }),
      ).resolves.toBe(matches)

      expect(rootLoader).toHaveBeenCalledTimes(1)

      const rootMatch = router.stores.pendingMatches
        .get()
        .find((m) => m.routeId === rootRoute.id)

      expect(rootMatch?.globalNotFound).toBe(false)
      expect(rootMatch?.error).toBeUndefined()
    })
  })
})

describe('params.parse notFound', () => {
  test('throws notFound on invalid params', async () => {
    const rootRoute = new BaseRootRoute({})
    const testRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/test/$id',
      params: {
        parse: ({ id }: { id: string }) => {
          const parsed = parseInt(id, 10)
          if (Number.isNaN(parsed)) {
            throw notFound()
          }
          return { id: parsed }
        },
      },
    })
    const routeTree = rootRoute.addChildren([testRoute])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/test/invalid'] }),
    })

    await router.load()

    const match = router.stores.matches
      .get()
      .find((m) => m.routeId === testRoute.id)

    expect(match?.status).toBe('notFound')
  })

  test('succeeds on valid params', async () => {
    const rootRoute = new BaseRootRoute({})
    const testRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/test/$id',
      params: {
        parse: ({ id }: { id: string }) => {
          const parsed = parseInt(id, 10)
          if (Number.isNaN(parsed)) {
            throw notFound()
          }
          return { id: parsed }
        },
      },
    })
    const routeTree = rootRoute.addChildren([testRoute])
    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/test/123'] }),
    })

    await router.load()

    const match = router.state.matches.find((m) => m.routeId === testRoute.id)
    expect(match?.status).toBe('success')
    expect(router.state.statusCode).toBe(200)
  })
})

describe('routeId in context options', () => {
  test('beforeLoad and context receive correct routeId for root route', async () => {
    const beforeLoad = vi.fn()
    const context = vi.fn()
    const rootRoute = new BaseRootRoute({
      beforeLoad,
      context,
    })

    const routeTree = rootRoute.addChildren([])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.load()

    expect(beforeLoad).toHaveBeenCalledTimes(1)
    expect(beforeLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: rootRouteId,
      }),
    )

    expect(context).toHaveBeenCalledTimes(1)
    expect(context).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: rootRouteId,
      }),
    )
  })

  test('beforeLoad and context receive correct routeId for child route', async () => {
    const beforeLoad = vi.fn()
    const context = vi.fn()
    const rootRoute = new BaseRootRoute({})

    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
      beforeLoad,
      context,
    })

    const routeTree = rootRoute.addChildren([fooRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.navigate({ to: '/foo' })

    expect(beforeLoad).toHaveBeenCalledTimes(1)
    expect(beforeLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: '/foo',
      }),
    )

    expect(context).toHaveBeenCalledTimes(1)
    expect(context).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: '/foo',
      }),
    )
  })

  test('beforeLoad and context receive correct routeId for nested route', async () => {
    const parentBeforeLoad = vi.fn()
    const parentContext = vi.fn()
    const childBeforeLoad = vi.fn()
    const childContext = vi.fn()
    const rootRoute = new BaseRootRoute({})

    const parentRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/parent',
      beforeLoad: parentBeforeLoad,
      context: parentContext,
    })

    const childRoute = new BaseRoute({
      getParentRoute: () => parentRoute,
      path: '/child',
      beforeLoad: childBeforeLoad,
      context: childContext,
    })

    const routeTree = rootRoute.addChildren([
      parentRoute.addChildren([childRoute]),
    ])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.navigate({ to: '/parent/child' })

    expect(parentBeforeLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: '/parent',
      }),
    )
    expect(parentContext).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: '/parent',
      }),
    )
    expect(childBeforeLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: '/parent/child',
      }),
    )
    expect(childContext).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: '/parent/child',
      }),
    )
  })

  test('beforeLoad and context receive correct routeId for route with dynamic params', async () => {
    const beforeLoad = vi.fn()
    const context = vi.fn()
    const rootRoute = new BaseRootRoute({})

    const postRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/$postId',
      beforeLoad,
      context,
    })

    const routeTree = rootRoute.addChildren([postRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.navigate({ to: '/posts/$postId', params: { postId: '123' } })

    expect(beforeLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: '/posts/$postId',
      }),
    )
    expect(context).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: '/posts/$postId',
      }),
    )
  })

  test('beforeLoad and context receive correct routeId for layout route', async () => {
    const beforeLoad = vi.fn()
    const context = vi.fn()
    const rootRoute = new BaseRootRoute({})

    const layoutRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      id: '/_layout',
      beforeLoad,
      context,
    })

    const indexRoute = new BaseRoute({
      getParentRoute: () => layoutRoute,
      path: '/',
    })

    const routeTree = rootRoute.addChildren([
      layoutRoute.addChildren([indexRoute]),
    ])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    await router.load()

    expect(beforeLoad).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: '/_layout',
      }),
    )
    expect(context).toHaveBeenCalledWith(
      expect.objectContaining({
        routeId: '/_layout',
      }),
    )
  })
})

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
