import {
  Link,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { expectTypeOf, test } from 'vitest'
import * as v from 'valibot'
import { valibotValidator } from '../src'

test('when creating a route with valibot validation', () => {
  const rootRoute = createRootRoute({
    validateSearch: valibotValidator(
      v.object({
        page: v.optional(v.number(), 0),
      }),
    ),
  })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: valibotValidator(
      v.object({
        indexPage: v.optional(v.number(), 0),
      }),
    ),
  })

  const routeTree = rootRoute.addChildren([indexRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(Link<typeof router, string, '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | true>()
    .toEqualTypeOf<{ page?: number; indexPage?: number } | undefined>()

  expectTypeOf(Link<typeof router, string, '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ page?: number; indexPage?: number }>()

  expectTypeOf(Link<typeof router, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ page: number } | { page: number; indexPage: number }>()

  expectTypeOf(rootRoute.useSearch<typeof router>()).toEqualTypeOf<{
    page: number
  }>()
  expectTypeOf(rootRoute.useSearch<typeof router>()).toEqualTypeOf<{
    page: number
  }>
})

test('when using valibot schema with function', () => {
  const rootRoute = createRootRoute({
    validateSearch: (input) =>
      v.parse(
        v.object({
          page: v.optional(v.number(), 0),
        }),
        input,
      ),
  })

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    validateSearch: (input) =>
      v.parse(
        v.object({
          indexPage: v.optional(v.number(), 0),
        }),
        input,
      ),
  })

  const routeTree = rootRoute.addChildren([indexRoute])

  const router = createRouter({ routeTree })

  expectTypeOf(Link<typeof router, string, '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .exclude<Function | true>()
    .toEqualTypeOf<{ page: number; indexPage: number }>()

  expectTypeOf(Link<typeof router, string, '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .returns.toEqualTypeOf<{ page: number; indexPage: number }>()

  expectTypeOf(Link<typeof router, '/', '/'>)
    .parameter(0)
    .toHaveProperty('search')
    .parameter(0)
    .toEqualTypeOf<{ page: number } | { page: number; indexPage: number }>()

  expectTypeOf(rootRoute.useSearch<typeof router>()).toEqualTypeOf<{
    page: number
  }>()
  expectTypeOf(rootRoute.useSearch<typeof router>()).toEqualTypeOf<{
    page: number
  }>
})
