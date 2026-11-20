import { expectTypeOf, test } from 'vitest'
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from '../src'

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

test('can pass default router to the provider', () => {
  expectTypeOf(RouterProvider<DefaultRouter>)
    .parameter(0)
    .toMatchTypeOf<{
      router: DefaultRouter
      routeTree?: DefaultRouter['routeTree']
    }>()
})
