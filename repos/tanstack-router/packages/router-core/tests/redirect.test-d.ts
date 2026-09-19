import { describe, expectTypeOf, test } from 'vitest'
import {
  BaseRootRoute,
  BaseRoute,
  BaseRouteApi,
  redirect,
  type Redirect,
  type RedirectFnRoute,
  type RedirectOptionsRoute,
} from '../src'

describe('RedirectFnRoute', () => {
  test('should be callable with redirect options', () => {
    type TestRedirectFn = RedirectFnRoute<'/users/$userId'>

    expectTypeOf<TestRedirectFn>().toBeCallableWith({
      to: '/' as const,
    })
  })

  test('should not require from option', () => {
    type TestRedirectFn = RedirectFnRoute<'/users/$userId'>

    // from should not be in the options type
    expectTypeOf<Parameters<TestRedirectFn>[0]>().not.toHaveProperty('from')
  })

  test('should return Redirect type', () => {
    type TestRedirectFn = RedirectFnRoute<'/users/$userId'>

    expectTypeOf<ReturnType<TestRedirectFn>>().toMatchTypeOf<Response>()
  })
})

describe('RedirectOptionsRoute', () => {
  test('should not have from property', () => {
    type TestOptions = RedirectOptionsRoute<'/users/$userId'>

    // from should be omitted
    expectTypeOf<TestOptions>().not.toHaveProperty('from')
  })

  test('should have to property', () => {
    type TestOptions = RedirectOptionsRoute<'/users/$userId'>

    // Should be able to specify to
    const optionsWithTo: TestOptions = { to: '/' }
    expectTypeOf(optionsWithTo).toMatchTypeOf<TestOptions>()
  })

  test('should allow statusCode option', () => {
    type TestOptions = RedirectOptionsRoute<'/users/$userId'>

    const options: TestOptions = { to: '/', statusCode: 301 }
    expectTypeOf(options).toMatchTypeOf<TestOptions>()
  })

  test('should allow href option for external redirects', () => {
    type TestOptions = RedirectOptionsRoute<'/users/$userId'>

    // href can be used with to
    const options: TestOptions = { to: '/', href: 'http://example.com' }
    expectTypeOf(options).toMatchTypeOf<TestOptions>()
  })
})

describe('BaseRoute.redirect', () => {
  test('should have redirect property on BaseRoute', () => {
    const rootRoute = new BaseRootRoute({})
    const usersRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
    })

    expectTypeOf(usersRoute.redirect).toBeFunction()
  })

  test('should create redirect with to option', () => {
    const rootRoute = new BaseRootRoute({})
    const usersRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/users/$userId',
    })

    // Should be callable with to option
    const result = usersRoute.redirect({ to: '/' })
    expectTypeOf(result).toMatchTypeOf<Response>()
  })
})

describe('BaseRouteApi.redirect', () => {
  test('should have redirect property on BaseRouteApi', () => {
    const routeApi = new BaseRouteApi({ id: '/users/$userId' })

    expectTypeOf(routeApi.redirect).toBeFunction()
  })

  test('should create redirect with to option', () => {
    const routeApi = new BaseRouteApi({ id: '/users/$userId' })

    // Should be callable with to option
    const result = routeApi.redirect({ to: '/' })
    expectTypeOf(result).toMatchTypeOf<Response>()
  })
})

describe('redirect vs Route.redirect comparison', () => {
  test('regular redirect can use from for type inference', () => {
    // Regular redirect - from is optional but helps with type inference
    const regularRedirect = redirect({
      to: '/users' as const,
      from: '/posts/$postId' as const,
    })
    expectTypeOf(regularRedirect).toMatchTypeOf<Response>()
  })

  test('Route.redirect automatically sets from', () => {
    const rootRoute = new BaseRootRoute({})
    const postsRoute = new BaseRoute({
      getParentRoute: () => rootRoute,
      path: '/posts/$postId',
    })

    // Route.redirect - from is automatically set from fullPath
    const routeRedirect = postsRoute.redirect({
      to: '/',
    })
    expectTypeOf(routeRedirect).toMatchTypeOf<Response>()
  })

  test('RouteApi.redirect automatically sets from', () => {
    const routeApi = new BaseRouteApi({ id: '/posts/$postId' })

    // RouteApi.redirect - from is automatically set from route id
    const routeApiRedirect = routeApi.redirect({
      to: '/',
    })
    expectTypeOf(routeApiRedirect).toMatchTypeOf<Response>()
  })
})
