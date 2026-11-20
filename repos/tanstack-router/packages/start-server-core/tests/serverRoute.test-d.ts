import { test } from 'vitest'

test('dummy', () => {})
/*
import { expectTypeOf, test } from 'vitest'
import '../../start-client-core/src/serverRoute'
import { createMiddleware } from '../../start-client-core/src/createMiddleware'
import { createFileRoute as defaultCreateFileRoute } from '../../react-router/src/fileRoute'
import type { CreateFileRoute } from '../../router-core/src/fileRoute'

test('createServerFileRoute with methods with no middleware', () => {
  type Path = '$detailId'
  const createFileRoute: CreateFileRoute<Path, any, Path, Path, Path> =
    defaultCreateFileRoute as never

  const options: Parameters<typeof createFileRoute>[0] = {
    methods: {
      GET: (ctx) => {
        expectTypeOf(ctx).toEqualTypeOf<{
          context: undefined
          params: { detailId: string }
          pathname: '$detailId'
          request: Request
        }>()
      },
    },
  }

  const fileRoute = createFileRoute()

  expectTypeOf(fileRoute.methods).toBeFunction()
  expectTypeOf(fileRoute.middleware).toBeFunction()

  fileRoute.methods({
    GET: (ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<{
        context: undefined
        params: { detailId: string }
        pathname: '$detailId'
        request: Request
      }>()

      return Response.json({
        test: 'test',
      })
    },
  })

  fileRoute.methods((r) => ({
    GET: r.handler((ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<{
        context: undefined
        params: { detailId: string }
        pathname: '$detailId'
        request: Request
      }>()

      return Response.json({
        test: 'test',
      })
    }),
  }))
})

test('createServerFileRoute with methods and route middleware context', () => {
  type Path = '$detailId'
  const createFileRoute: CreateFileRoute<Path, any, Path, Path, Path> =
    defaultCreateFileRoute as never

  const routeMiddleware = createMiddleware({ type: 'request' }).server(
    ({ next }) => next({ context: { a: 'a' } }),
  )

  const serverFileRoute = createFileRoute().middleware([routeMiddleware])

  fileRoute.methods({
    GET: (ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<{
        context: { a: string }
        params: { detailId: string }
        pathname: '$detailId'
        request: Request
      }>()

      return Response.json({
        test: 'test',
      })
    },
  })

  fileRoute.methods((r) => ({
    GET: r.handler((ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<{
        context: { a: string }
        params: { detailId: string }
        pathname: '$detailId'
        request: Request
      }>()

      return Response.json({
        test: 'test',
      })
    }),
  }))
})

test('createServerFileRoute with methods middleware and route middleware', () => {
  type Path = '$detailId'
  const createFileRoute: CreateFileRoute<Path, any, Path, Path, Path> =
    defaultCreateFileRoute as never

  const routeMiddleware = createMiddleware({ type: 'request' }).server(
    ({ next }) => next({ context: { a: 'a' } }),
  )

  const fileRoute = createFileRoute().middleware([routeMiddleware])

  const methodMiddleware = createMiddleware({ type: 'request' }).server(
    ({ next }) => next({ context: { b: 'b' } }),
  )

  fileRoute.methods((r) => ({
    GET: r.middleware([methodMiddleware]).handler((ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<{
        context: { a: string; b: string }
        params: { detailId: string }
        pathname: '$detailId'
        request: Request
      }>()

      return Response.json({
        test: 'test',
      })
    }),
  }))
})

test('createServerFileRoute with a parent middleware context', () => {
  const createDetailsFileRoute: CreateFileRoute<
    'details',
    any,
    'details',
    'details',
    'details'
  > = defaultCreateFileRoute as never

  const routeMiddleware1 = createMiddleware({ type: 'request' }).server(
    ({ next }) => {
      return next({ context: { a: 'a' } })
    },
  )

  const _detailsRoute = createDetailsFileRoute().middleware([routeMiddleware1])

  const createDetailFileRoute: CreateFileRoute<
    'details/$detailId',
    typeof _detailsRoute,
    '$detailId',
    'details/$detailId',
    'details/$detailId'
  > = defaultCreateFileRoute as never

  const routeMiddleware2 = createMiddleware({ type: 'request' }).server(
    ({ next }) => {
      return next({ context: { b: 'b' } })
    },
  )

  createDetailFileRoute()
    .middleware([routeMiddleware2])
    .methods({
      GET: (ctx) => {
        expectTypeOf(ctx).toEqualTypeOf<{
          context: { a: string; b: string }
          params: { detailId: string }
          pathname: 'details/$detailId'
          request: Request
        }>()

        return Response.json({ test: 'test' })
      },
    })

  const methodMiddleware = createMiddleware({ type: 'request' }).server(
    ({ next }) => {
      return next({ context: { c: 'c' } })
    },
  )

  createDetailFileRoute()
    .middleware([routeMiddleware2])
    .methods((r) => ({
      GET: r.middleware([methodMiddleware]).handler((ctx) => {
        expectTypeOf(ctx).toEqualTypeOf<{
          context: { a: string; b: string; c: string }
          params: { detailId: string }
          pathname: 'details/$detailId'
          request: Request
        }>()

        return Response.json({ test: 'test' })
      }),
    }))
})

test('createServerFileRoute with parent middleware params', () => {
  const createDetailsFileRoute: CreateFileRoute<
    '$userId',
    any,
    '$userId',
    '$userId',
    '$userId'
  > = defaultCreateFileRoute as never

  const _detailsServerRoute = createDetailsFileRoute()

  const createDetailFileRoute: CreateFileRoute<
    '$userId/$detailId',
    typeof _detailsServerRoute,
    '$detailId',
    '$userId/$detailId',
    '$userId/$detailId'
  > = defaultCreateFileRoute as never

  createDetailFileRoute().methods({
    GET: (ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<{
        context: undefined
        params: { userId: string; detailId: string }
        pathname: '$userId/$detailId'
        request: Request
      }>()

      return Response.json({ test: 'test' })
    },
  })

  createDetailFileRoute().methods((r) => ({
    GET: r.handler((ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<{
        context: undefined
        params: { userId: string; detailId: string }
        pathname: '$userId/$detailId'
        request: Request
      }>()

      return Response.json({ test: 'test' })
    }),
  }))
})

test('createServerFileRoute with no params', () => {
  const createDetailsFileRoute: CreateFileRoute<
    'details',
    any,
    'details',
    'details',
    'details'
  > = defaultCreateFileRoute as never

  createDetailsFileRoute().methods({
    GET: (ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<{
        context: undefined
        params: {}
        pathname: 'details'
        request: Request
      }>()

      return Response.json({ test: 'test' })
    },
  })

  createDetailsFileRoute().methods((r) => ({
    GET: r.handler((ctx) => {
      expectTypeOf(ctx).toEqualTypeOf<{
        context: undefined
        params: {}
        pathname: 'details'
        request: Request
      }>()

      return Response.json({ test: 'test' })
    }),
  }))
})

*/
