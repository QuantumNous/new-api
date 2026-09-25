import { describe, expectTypeOf, test } from 'vitest'
import { createRootRoute, createRoute, createRouter, getRouteApi } from '../src'
import type { Accessor } from 'solid-js'
import type { MakeRouteMatch, UseNavigateResult } from '@tanstack/router-core'
import type { LinkComponentRoute } from '../src/link'

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
  beforeLoad: () => ({ beforeLoadContext: 0 }),
  loaderDeps: () => ({ dep: 0 }),
  loader: () => ({ data: 0 }),
})

const routeTree = rootRoute.addChildren([
  invoicesRoute.addChildren([invoicesIndexRoute, invoiceRoute]),
  indexRoute,
])

const defaultRouter = createRouter({
  routeTree,
})

type DefaultRouter = typeof defaultRouter

type ExtractDefaultFrom<T> =
  T extends UseNavigateResult<infer DefaultFrom> ? DefaultFrom : never

describe('getRouteApi', () => {
  const invoiceRouteApi = getRouteApi<'/invoices/$invoiceId', DefaultRouter>(
    '/invoices/$invoiceId',
  )
  describe('useNavigate', () => {
    test('has a static `from`', () => {
      const navigate = invoiceRouteApi.useNavigate()
      navigate
      expectTypeOf<
        ExtractDefaultFrom<typeof navigate>
      >().toEqualTypeOf<'/invoices/$invoiceId'>()
    })
  })
  test('useParams', () => {
    expectTypeOf(invoiceRouteApi.useParams<DefaultRouter>()).toEqualTypeOf<
      Accessor<{
        invoiceId: string
      }>
    >()
  })
  test('useContext', () => {
    expectTypeOf(
      invoiceRouteApi.useRouteContext<DefaultRouter>(),
    ).toEqualTypeOf<
      Accessor<{
        beforeLoadContext: number
      }>
    >()
  })
  test('useSearch', () => {
    expectTypeOf(invoiceRouteApi.useSearch<DefaultRouter>()).toEqualTypeOf<
      Accessor<{
        page: number
      }>
    >()
  })
  test('useLoaderData', () => {
    expectTypeOf(invoiceRouteApi.useLoaderData<DefaultRouter>()).toEqualTypeOf<
      Accessor<{
        data: number
      }>
    >()
  })
  test('useLoaderDeps', () => {
    expectTypeOf(invoiceRouteApi.useLoaderDeps<DefaultRouter>()).toEqualTypeOf<
      Accessor<{
        dep: number
      }>
    >()
  })
  test('useMatch', () => {
    expectTypeOf(invoiceRouteApi.useMatch<DefaultRouter>()).toEqualTypeOf<
      Accessor<MakeRouteMatch<typeof routeTree, '/invoices/$invoiceId'>>
    >()
  })
  test('Link', () => {
    const Link = invoiceRouteApi.Link
    expectTypeOf(Link).toEqualTypeOf<
      LinkComponentRoute<'/invoices/$invoiceId'>
    >()
  })
})

describe('createRoute', () => {
  describe('useNavigate', () => {
    test('has a static `from`', () => {
      const navigate = invoiceRoute.useNavigate()
      expectTypeOf<
        ExtractDefaultFrom<typeof navigate>
      >().toEqualTypeOf<'/invoices/$invoiceId'>()
    })
  })
})
