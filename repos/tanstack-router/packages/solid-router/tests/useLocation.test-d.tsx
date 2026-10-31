import { expectTypeOf, test } from 'vitest'
import { createRootRoute, createRoute, createRouter, useLocation } from '../src'
import type { ParsedLocation } from '../src'

const rootRoute = createRootRoute()

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
})

const invoicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'invoices',
})

const routeTree = rootRoute.addChildren([invoicesRoute, indexRoute])

const defaultRouter = createRouter({ routeTree })

type DefaultRouter = typeof defaultRouter

test('should have the types for a ParsedLocation in useLocation', () => {
  const location = useLocation<DefaultRouter>()

  expectTypeOf(location()).toEqualTypeOf<ParsedLocation>()
  expectTypeOf(location())
    .toHaveProperty('pathname')
    .toEqualTypeOf<ParsedLocation['pathname']>()
})

test('should have the type of string for selecting the pathname in useLocation', () => {
  const pathname = useLocation<DefaultRouter, string>({
    select: (state) => state.pathname,
  })()

  expectTypeOf(pathname).toMatchTypeOf<ParsedLocation['pathname']>()
})
