import { expectTypeOf, test } from 'vitest'
import { createRootRoute, createRoute, createRouter, useBlocker } from '../src'

test('blocker without resolver', () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
  })

  const invoicesIndexRoute = createRoute({
    getParentRoute: () => invoicesRoute,
    path: '/',
  })

  const routeTree = rootRoute.addChildren([
    invoicesRoute.addChildren([invoicesIndexRoute]),
    indexRoute,
  ])

  // eslint-disable-next-line unused-imports/no-unused-vars
  const defaultRouter = createRouter({
    routeTree,
  })

  type DefaultRouter = typeof defaultRouter

  expectTypeOf(useBlocker<DefaultRouter, false>).returns.toBeVoid()
})

test('blocker with resolver', () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
  })

  const invoicesIndexRoute = createRoute({
    getParentRoute: () => invoicesRoute,
    path: '/',
  })

  const routeTree = rootRoute.addChildren([
    invoicesRoute.addChildren([invoicesIndexRoute]),
    indexRoute,
  ])

  // eslint-disable-next-line unused-imports/no-unused-vars
  const defaultRouter = createRouter({
    routeTree,
  })

  type DefaultRouter = typeof defaultRouter

  expectTypeOf(useBlocker<DefaultRouter, true>).returns.toBeObject()
})

test('shouldBlockFn has corrent action', () => {
  const rootRoute = createRootRoute()

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
  })

  const invoicesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: 'invoices',
  })

  const invoicesIndexRoute = createRoute({
    getParentRoute: () => invoicesRoute,
    path: '/',
  })

  const routeTree = rootRoute.addChildren([
    invoicesRoute.addChildren([invoicesIndexRoute]),
    indexRoute,
  ])

  // eslint-disable-next-line unused-imports/no-unused-vars
  const defaultRouter = createRouter({
    routeTree,
  })

  type DefaultRouter = typeof defaultRouter

  expectTypeOf(useBlocker<DefaultRouter>)
    .parameter(0)
    .toHaveProperty('shouldBlockFn')
    .parameter(0)
    .toHaveProperty('action')
    .toEqualTypeOf<'PUSH' | 'REPLACE' | 'FORWARD' | 'BACK' | 'GO'>()

  expectTypeOf(useBlocker<DefaultRouter>)
    .parameter(0)
    .toHaveProperty('shouldBlockFn')
    .parameter(0)
    .toHaveProperty('current')
    .toHaveProperty('routeId')
    .toEqualTypeOf<'__root__' | '/' | '/invoices' | '/invoices/'>()

  expectTypeOf(useBlocker<DefaultRouter>)
    .parameter(0)
    .toHaveProperty('shouldBlockFn')
    .parameter(0)
    .toHaveProperty('next')
    .toHaveProperty('routeId')
    .toEqualTypeOf<'__root__' | '/' | '/invoices' | '/invoices/'>()
})
