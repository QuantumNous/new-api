import {
  BaseRootRoute,
  BaseRoute,
  RouterCore,
  createNonReactiveMutableStore,
  createNonReactiveReadonlyStore,
  trimPathRight,
} from '@tanstack/router-core'
import { describe, expect, it } from 'vitest'
import { getHandleRouteUpdateCode } from '../src/core/hmr'
import type { AnyRoute, GetStoreConfig } from '@tanstack/router-core'

const getStoreConfig: GetStoreConfig = () => ({
  createMutableStore: createNonReactiveMutableStore,
  createReadonlyStore: createNonReactiveReadonlyStore,
  batch: (fn) => fn(),
})

const getHandleRouteUpdate = () => {
  return new Function(`return ${getHandleRouteUpdateCode([])}`)() as (
    routeId: string,
    newRoute: AnyRoute,
  ) => void
}

function createTestHistory() {
  const location = {
    href: '/',
    pathname: '/',
    search: '',
    hash: '',
    state: { __TSR_index: 0 },
  }

  return {
    location,
    length: 1,
    subscribers: new Set(),
    subscribe: () => () => {},
    push: () => {},
    replace: () => {},
    go: () => {},
    back: () => {},
    forward: () => {},
    canGoBack: () => false,
    createHref: (href: string) => href,
    block: () => () => {},
    flush: () => {},
    destroy: () => {},
    notify: () => {},
  }
}

function createTestRouter(routeTree: AnyRoute) {
  return new RouterCore(
    {
      routeTree,
      history: createTestHistory() as any,
      isServer: true,
    },
    getStoreConfig,
  )
}

function withWindowRouter(router: RouterCore<any, any, any, any, any>) {
  const previousWindow = (globalThis as any).window
  ;(globalThis as any).window = { __TSR_ROUTER__: router }

  return () => {
    if (previousWindow) {
      ;(globalThis as any).window = previousWindow
    } else {
      delete (globalThis as any).window
    }
  }
}

function getProcessedTreeRouteForPath(
  router: RouterCore<any, any, any, any, any>,
  path: string,
) {
  return router.buildRouteTree().routesByPath[path]?.id
}

describe('handleRouteUpdate', () => {
  it('keeps routesByPath pointed at an index route when a pathless layout updates', () => {
    const rootRoute = new BaseRootRoute({})
    const parentRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/livestock/$farmId/medicine',
    })
    const pathlessRoute = new BaseRoute({
      getParentRoute: () => parentRoute,
      id: '_form',
    })
    const newRoute = new BaseRoute({
      getParentRoute: () => pathlessRoute,
      path: 'new',
    })
    const indexRoute = new BaseRoute({
      getParentRoute: () => parentRoute,
      path: '/',
    })
    const routeTree = rootRoute.addChildren([
      parentRoute.addChildren([
        pathlessRoute.addChildren([newRoute]),
        indexRoute,
      ]),
    ])
    const router = createTestRouter(routeTree)
    const key = trimPathRight(indexRoute.fullPath)

    expect(router.routesByPath[key]?.id).toBe(indexRoute.id)

    const restoreWindow = withWindowRouter(router)
    try {
      getHandleRouteUpdate()(pathlessRoute.id, new BaseRoute({} as any))
    } finally {
      restoreWindow()
    }

    expect(router.routesByPath[key]?.id).toBe(indexRoute.id)
    expect(router.routesByPath[key]?.id).toBe(
      getProcessedTreeRouteForPath(router, key),
    )
  })

  it('keeps an index route winning the trimmed path key when its parent updates', () => {
    const rootRoute = new BaseRootRoute({})
    const parentRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/path',
    })
    const indexRoute = new BaseRoute({
      getParentRoute: () => parentRoute,
      path: '/',
    })
    const routeTree = rootRoute.addChildren([
      parentRoute.addChildren([indexRoute]),
    ])
    const router = createTestRouter(routeTree)
    const key = trimPathRight(indexRoute.fullPath)

    expect(router.routesByPath[key]?.id).toBe(indexRoute.id)

    const restoreWindow = withWindowRouter(router)
    try {
      getHandleRouteUpdate()(parentRoute.id, new BaseRoute({} as any))
    } finally {
      restoreWindow()
    }

    expect(router.routesByPath[key]?.id).toBe(indexRoute.id)
    expect(router.routesByPath[key]?.id).toBe(
      getProcessedTreeRouteForPath(router, key),
    )
  })

  it('refreshes matching data when params.parse changes', () => {
    const rootRoute = new BaseRootRoute({})
    const itemRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/items/$itemId',
      params: {
        parse: ({ itemId }: { itemId: string }) => {
          return /^\d+$/.test(itemId) ? { itemId } : false
        },
      },
    })
    const routeTree = rootRoute.addChildren([itemRoute])
    const router = createTestRouter(routeTree)

    expect(router.getMatchedRoutes('/items/abc').foundRoute?.id).toBeUndefined()

    const restoreWindow = withWindowRouter(router)
    try {
      getHandleRouteUpdate()(
        itemRoute.id,
        new BaseRoute({
          params: {
            parse: ({ itemId }: { itemId: string }) => ({ itemId }),
          },
        } as any),
      )
    } finally {
      restoreWindow()
    }

    expect(router.getMatchedRoutes('/items/abc').foundRoute?.id).toBe(
      itemRoute.id,
    )
  })

  it('hydrates the hot module route export with generated route tree state', () => {
    const rootRoute = new BaseRootRoute({})
    const itemRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/items/$itemId',
    })
    const routeTree = rootRoute.addChildren([itemRoute])
    const router = createTestRouter(routeTree)
    const newRoute = new BaseRoute({} as any)

    expect((newRoute as any).to).toBeUndefined()

    const restoreWindow = withWindowRouter(router)
    try {
      getHandleRouteUpdate()(itemRoute.id, newRoute)
    } finally {
      restoreWindow()
    }

    expect(newRoute.id).toBe(itemRoute.id)
    expect(newRoute.path).toBe(itemRoute.path)
    expect(newRoute.fullPath).toBe(itemRoute.fullPath)
    expect(newRoute.to).toBe(itemRoute.to)
    expect((newRoute as any).parentRoute).toBe(rootRoute)
    expect((newRoute as any).options).toBe((itemRoute as any).options)
  })
})
