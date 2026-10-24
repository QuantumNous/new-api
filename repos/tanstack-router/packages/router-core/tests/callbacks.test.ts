import { describe, expect, it, test, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/history'
import { BaseRootRoute, BaseRoute } from '../src'
import { createTestRouter } from './routerTestUtils'

describe('callbacks', () => {
  const setup = ({
    onEnter,
    onLeave,
    onStay,
  }: {
    onEnter?: () => void
    onLeave?: () => void
    onStay?: () => void
  }) => {
    const rootRoute = new BaseRootRoute({})

    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
      onLeave,
      onEnter,
      onStay,
    })

    const barRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/bar',
      onLeave,
      onEnter,
      onStay,
    })

    const routeTree = rootRoute.addChildren([fooRoute, barRoute])

    const router = createTestRouter({
      routeTree,
      history: createMemoryHistory(),
    })

    return router
  }

  const createFooRouter = (
    opts: {
      onEnter?: () => void
      onLeave?: () => void
      onStay?: () => void
      loader?: () => unknown
      staleTime?: number
    } = {},
  ) => {
    const rootRoute = new BaseRootRoute({})
    const fooRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/foo',
      loaderDeps: ({ search }: { search: Record<string, unknown> }) => ({
        page: search['page'],
      }),
      onEnter: opts.onEnter,
      onLeave: opts.onLeave,
      onStay: opts.onStay,
      loader: opts.loader,
      staleTime: opts.staleTime,
      gcTime: opts.staleTime,
    })
    return createTestRouter({
      routeTree: rootRoute.addChildren([fooRoute]),
      history: createMemoryHistory(),
    })
  }
  describe('onEnter', () => {
    it('runs on navigate to a new route', async () => {
      const onEnter = vi.fn()
      const router = setup({ onEnter })

      // Entering foo
      await router.navigate({ to: '/foo' })
      expect(onEnter).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ id: '/foo/foo' }),
      )

      // Entering bar
      await router.navigate({ to: '/bar' })
      expect(onEnter).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ id: '/bar/bar' }),
      )
    })
  })

  describe('onLeave', () => {
    it('runs on navigate from a previous route', async () => {
      const onLeave = vi.fn()
      const router = setup({ onLeave })
      await router.navigate({ to: '/foo' })

      // Leaving foo to bar
      await router.navigate({ to: '/bar' })
      expect(onLeave).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ id: '/foo/foo' }),
      )

      // Leaving bar to foo
      await router.navigate({ to: '/foo' })
      expect(onLeave).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ id: '/bar/bar' }),
      )
    })
  })

  describe('onStay', () => {
    it('runs on navigate to the same route', async () => {
      const onStay = vi.fn()
      const router = setup({ onStay })
      await router.navigate({ to: '/foo' })

      // Staying on foo
      await router.navigate({ to: '/foo', search: { foo: 'baz' } })
      expect(onStay).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ id: '/foo/foo', search: { foo: 'baz' } }),
      )

      // Staying on foo
      await router.navigate({ to: '/foo', search: { foo: 'quux' } })
      expect(onStay).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ id: '/foo/foo', search: { foo: 'quux' } }),
      )
    })

    it('runs instead of onLeave/onEnter when loaderDeps change from search param updates', async () => {
      const onEnter = vi.fn()
      const onLeave = vi.fn()
      const onStay = vi.fn()
      const router = createFooRouter({ onEnter, onLeave, onStay })

      // Navigate to foo — onEnter should fire
      await router.navigate({ to: '/foo', search: { page: '1' } })
      expect(onEnter).toHaveBeenCalledTimes(1)
      expect(onLeave).toHaveBeenCalledTimes(0)
      expect(onStay).toHaveBeenCalledTimes(0)

      // Update search param that's in loaderDeps — onStay should fire, not onLeave+onEnter
      await router.navigate({ to: '/foo', search: { page: '2' } })
      expect(onEnter).toHaveBeenCalledTimes(1) // no new onEnter
      expect(onLeave).toHaveBeenCalledTimes(0) // no onLeave
      expect(onStay).toHaveBeenCalledTimes(1) // onStay fires

      // Update again — onStay fires again
      await router.navigate({ to: '/foo', search: { page: '3' } })
      expect(onEnter).toHaveBeenCalledTimes(1)
      expect(onLeave).toHaveBeenCalledTimes(0)
      expect(onStay).toHaveBeenCalledTimes(2)
    })
  })

  // Regression tests: switching lifecycle hooks to use routeId must NOT break
  // match-level caching, which still relies on match.id (routeId + params + loaderDeps).
  describe('same-route match caching', () => {
    const setupWithPathParams = ({
      loader,
      staleTime,
    }: {
      loader?: () => unknown
      staleTime?: number
    }) => {
      const rootRoute = new BaseRootRoute({})
      const postRoute = new BaseRoute({
        getParentRoute: () => rootRoute,
        path: '/posts/$postId',
        loader,
        staleTime,
        gcTime: staleTime,
      })
      const routeTree = rootRoute.addChildren([postRoute])
      return createTestRouter({
        routeTree,
        history: createMemoryHistory(),
      })
    }

    test('keeps previous loaderDeps variant cached and reuses it within staleTime', async () => {
      const loader = vi.fn()
      const router = createFooRouter({ loader, staleTime: 60_000 })

      await router.navigate({ to: '/foo', search: { page: '1' } })
      const page1MatchId = router.state.matches.find(
        (d) => d.routeId === '/foo',
      )?.id
      expect(page1MatchId).toBeDefined()

      await router.navigate({ to: '/foo', search: { page: '2' } })
      const page2MatchId = router.state.matches.find(
        (d) => d.routeId === '/foo',
      )?.id
      expect(page2MatchId).toBeDefined()
      expect(page2MatchId).not.toBe(page1MatchId)
      expect(
        router.stores.cachedIds.get().some((id) => id === page1MatchId),
      ).toBe(true)

      await router.navigate({ to: '/foo', search: { page: '1' } })
      expect(loader).toHaveBeenCalledTimes(2)
      expect(router.state.matches.some((d) => d.id === page1MatchId)).toBe(true)
    })

    test('keeps previous params variant cached and reuses it within staleTime', async () => {
      const loader = vi.fn()
      const router = setupWithPathParams({ loader, staleTime: 60_000 })

      await router.navigate({ to: '/posts/$postId', params: { postId: '1' } })
      const post1MatchId = router.state.matches.find(
        (d) => d.routeId === '/posts/$postId',
      )?.id
      expect(post1MatchId).toBeDefined()

      await router.navigate({ to: '/posts/$postId', params: { postId: '2' } })
      const post2MatchId = router.state.matches.find(
        (d) => d.routeId === '/posts/$postId',
      )?.id
      expect(post2MatchId).toBeDefined()
      expect(post2MatchId).not.toBe(post1MatchId)
      expect(
        router.stores.cachedIds.get().some((id) => id === post1MatchId),
      ).toBe(true)

      await router.navigate({ to: '/posts/$postId', params: { postId: '1' } })
      expect(loader).toHaveBeenCalledTimes(2)
      expect(router.state.matches.some((d) => d.id === post1MatchId)).toBe(true)
    })
  })

  // Verify that router-level subscription events still fire correctly.
  // These are used by integrations like Sentry's TanStack Router instrumentation
  // (https://github.com/getsentry/sentry-javascript/blob/develop/packages/react/src/tanstackrouter.ts)
  // to track page transitions.
  describe('onBeforeNavigate event', () => {
    it('fires when navigating to a new route', async () => {
      const router = setup({})
      const onBeforeNavigate = vi.fn()
      router.subscribe('onBeforeNavigate', onBeforeNavigate)

      await router.navigate({ to: '/foo' })
      expect(onBeforeNavigate).toHaveBeenCalledTimes(1)
      expect(onBeforeNavigate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'onBeforeNavigate',
          pathChanged: true,
        }),
      )
    })

    it('fires on every navigation including same-route loaderDeps changes', async () => {
      const router = createFooRouter({})
      const onBeforeNavigate = vi.fn()
      router.subscribe('onBeforeNavigate', onBeforeNavigate)

      await router.navigate({ to: '/foo', search: { page: '1' } })
      expect(onBeforeNavigate).toHaveBeenCalledTimes(1)

      // loaderDeps change — same route, different params
      await router.navigate({ to: '/foo', search: { page: '2' } })
      expect(onBeforeNavigate).toHaveBeenCalledTimes(2)
    })

    it('includes toLocation and pathChanged in the event', async () => {
      const router = setup({})
      const events: Array<{ to: string; pathChanged: boolean }> = []
      router.subscribe('onBeforeNavigate', (e) => {
        events.push({
          to: e.toLocation.pathname,
          pathChanged: e.pathChanged,
        })
      })

      await router.navigate({ to: '/foo' })
      await router.navigate({ to: '/bar' })

      expect(events).toHaveLength(2)
      expect(events[0]).toMatchObject({ to: '/foo', pathChanged: true })
      expect(events[1]).toMatchObject({ to: '/bar', pathChanged: true })
    })
  })
})
