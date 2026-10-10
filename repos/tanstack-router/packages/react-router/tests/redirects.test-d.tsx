import { expectTypeOf, test } from 'vitest'
import { createRootRoute, createRoute, createRouter, redirect } from '../src'

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

const invoiceRoute = createRoute({
  getParentRoute: () => invoicesRoute,
  path: '$invoiceId',
  validateSearch: () => ({ page: 0 }),
})

const routeTree = rootRoute.addChildren([
  invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
  indexRoute,
])

const defaultRouter = createRouter({
  routeTree,
})

type DefaultRouter = typeof defaultRouter

test('can redirect to valid route', () => {
  expectTypeOf(redirect<DefaultRouter, '/invoices', string>)
    .parameter(0)
    .toHaveProperty('to')
    .toEqualTypeOf<'/' | '/invoices' | '/invoices/$invoiceId' | '.' | '..'>()
})
