import { expectTypeOf, test } from 'vitest'
import { createMiddleware } from '../createMiddleware'
import type { RequestServerNextFn } from '../createMiddleware'
import type { ConstrainValidator, CustomFetch } from '../createServerFn'
import type { Register, SerializationError } from '@tanstack/router-core'
import type { ServerFnMeta } from '../constants'

test('createServeMiddleware removes middleware after middleware,', () => {
  const middleware = createMiddleware({ type: 'function' })

  expectTypeOf(middleware).toHaveProperty('middleware')
  expectTypeOf(middleware).toHaveProperty('server')
  expectTypeOf(middleware).toHaveProperty('validator')
  // TODO remove upon stable
  expectTypeOf(middleware).toHaveProperty('inputValidator')

  const middlewareAfterMiddleware = middleware.middleware([])

  expectTypeOf(middlewareAfterMiddleware).toHaveProperty('validator')
  expectTypeOf(middlewareAfterMiddleware).toHaveProperty('server')
  expectTypeOf(middlewareAfterMiddleware).not.toHaveProperty('middleware')

  const middlewareAfterInput = middleware.validator(() => {})

  expectTypeOf(middlewareAfterInput).toHaveProperty('server')
  expectTypeOf(middlewareAfterInput).not.toHaveProperty('validator')
  expectTypeOf(middlewareAfterInput).not.toHaveProperty('middleware')

  const middlewareAfterServer = middleware.server(async (options) => {
    expectTypeOf(options.context).toEqualTypeOf<undefined>()
    expectTypeOf(options.data).toEqualTypeOf<undefined>()
    expectTypeOf(options.method).toEqualTypeOf<'GET' | 'POST'>()

    const result = await options.next({
      context: {
        a: 'a',
      },
    })

    expectTypeOf(result.context).toEqualTypeOf<{ a: string }>()

    expectTypeOf(result.sendContext).toEqualTypeOf<undefined>()

    return result
  })

  expectTypeOf(middlewareAfterServer).not.toHaveProperty('server')
  expectTypeOf(middlewareAfterServer).not.toHaveProperty('input')
  expectTypeOf(middlewareAfterServer).not.toHaveProperty('validator')
  expectTypeOf(middlewareAfterServer).not.toHaveProperty('middleware')
})

test('createMiddleware merges server context', () => {
  const middleware1 = createMiddleware({ type: 'function' }).server(
    async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<undefined>()
      expectTypeOf(options.data).toEqualTypeOf<undefined>()
      expectTypeOf(options.method).toEqualTypeOf<'GET' | 'POST'>()

      const result = await options.next({ context: { a: true } })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        '~types': {
          context: {
            a: boolean
          }
          sendContext: undefined
        }
        context: { a: boolean }
        sendContext: undefined
      }>()

      return result
    },
  )

  const middleware2 = createMiddleware({ type: 'function' }).server(
    async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<undefined>()
      expectTypeOf(options.data).toEqualTypeOf<undefined>()
      expectTypeOf(options.method).toEqualTypeOf<'GET' | 'POST'>()

      const result = await options.next({ context: { b: 'test' } })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        '~types': {
          context: {
            b: string
          }
          sendContext: undefined
        }
        context: { b: string }
        sendContext: undefined
      }>()

      return result
    },
  )

  const middleware3 = createMiddleware({ type: 'function' })
    .middleware([middleware1, middleware2])
    .server(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{ a: boolean; b: string }>()

      const result = await options.next({ context: { c: 0 } })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        '~types': {
          context: {
            c: number
          }
          sendContext: undefined
        }
        context: { a: boolean; b: string; c: number }
        sendContext: undefined
      }>()

      return result
    })

  createMiddleware({ type: 'function' })
    .middleware([middleware3])
    .server(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{
        a: boolean
        b: string
        c: number
      }>()

      const result = await options.next({ context: { d: 5 } })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        '~types': {
          context: {
            d: number
          }
          sendContext: undefined
        }
        context: { a: boolean; b: string; c: number; d: number }
        sendContext: undefined
      }>()

      return result
    })
})

test('createMiddleware merges client context and sends to the server', () => {
  const middleware1 = createMiddleware({ type: 'function' }).client(
    async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<undefined>()

      const result = await options.next({ context: { a: true } })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        context: { a: boolean }
        sendContext: undefined
        headers: HeadersInit
        fetch?: CustomFetch
      }>()

      return result
    },
  )

  const middleware2 = createMiddleware({ type: 'function' }).client(
    async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<undefined>()

      const result = await options.next({ context: { b: 'test' } })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        context: { b: string }
        sendContext: undefined
        headers: HeadersInit
        fetch?: CustomFetch
      }>()

      return result
    },
  )

  const middleware3 = createMiddleware({ type: 'function' })
    .middleware([middleware1, middleware2])
    .client(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{ a: boolean; b: string }>()

      const result = await options.next({ context: { c: 0 } })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        context: { a: boolean; b: string; c: number }
        sendContext: undefined
        headers: HeadersInit
        fetch?: CustomFetch
      }>()

      return result
    })

  const middleware4 = createMiddleware({ type: 'function' })
    .middleware([middleware3])
    .client(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{
        a: boolean
        b: string
        c: number
      }>()

      const result = await options.next({
        sendContext: { ...options.context, d: 5 },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        context: { a: boolean; b: string; c: number }
        sendContext: { a: boolean; b: string; c: number; d: 5 }
        headers: HeadersInit
        fetch?: CustomFetch
      }>()

      return result
    })

  createMiddleware({ type: 'function' })
    .middleware([middleware4])
    .server(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{
        a: boolean
        b: string
        c: number
        d: 5
      }>()

      const result = await options.next({
        context: {
          e: 'e',
        },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        '~types': {
          context: {
            e: string
          }
          sendContext: undefined
        }
        context: { a: boolean; b: string; c: number; d: 5; e: string }
        sendContext: undefined
      }>()

      return result
    })
})

test('createMiddleware merges input', () => {
  const middleware1 = createMiddleware({ type: 'function' })
    .validator(() => {
      return {
        a: 'a',
      } as const
    })
    .server(({ data, next }) => {
      expectTypeOf(data).toEqualTypeOf<{ readonly a: 'a' }>()
      return next()
    })

  const middleware2 = createMiddleware({ type: 'function' })
    .middleware([middleware1])
    .validator(() => {
      return {
        b: 'b',
      } as const
    })
    .server(({ data, next }) => {
      expectTypeOf(data).toEqualTypeOf<{ readonly a: 'a'; readonly b: 'b' }>
      return next()
    })

  createMiddleware({ type: 'function' })
    .middleware([middleware2])
    .validator(() => ({ c: 'c' }) as const)
    .server(({ next, data }) => {
      expectTypeOf(data).toEqualTypeOf<{
        readonly a: 'a'
        readonly b: 'b'
        readonly c: 'c'
      }>
      return next()
    })
})

test('createMiddleware merges server context and client context, sends server context to the client and merges ', () => {
  const middleware1 = createMiddleware({ type: 'function' })
    .client(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<undefined>()

      const result = await options.next({
        context: { fromClient1: 'fromClient1' },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        context: { fromClient1: string }
        sendContext: undefined
        headers: HeadersInit
        fetch?: CustomFetch
      }>()

      return result
    })
    .server(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<undefined>()

      const result = await options.next({
        context: { fromServer1: 'fromServer1' },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        '~types': {
          context: {
            fromServer1: string
          }
          sendContext: undefined
        }
        context: { fromServer1: string }
        sendContext: undefined
      }>()

      return result
    })

  const middleware2 = createMiddleware({ type: 'function' })
    .client(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<undefined>()

      const result = await options.next({
        context: { fromClient2: 'fromClient2' },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        context: { fromClient2: string }
        sendContext: undefined
        headers: HeadersInit
        fetch?: CustomFetch
      }>()

      return result
    })
    .server(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<undefined>()

      const result = await options.next({
        context: { fromServer2: 'fromServer2' },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        '~types': {
          context: {
            fromServer2: string
          }
          sendContext: undefined
        }
        context: { fromServer2: string }
        sendContext: undefined
      }>()

      return result
    })

  const middleware3 = createMiddleware({ type: 'function' })
    .middleware([middleware1, middleware2])
    .client(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{
        fromClient1: string
        fromClient2: string
      }>()

      const result = await options.next({
        context: { fromClient3: 'fromClient3' },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        context: {
          fromClient1: string
          fromClient2: string
          fromClient3: string
        }
        sendContext: undefined
        headers: HeadersInit
        fetch?: CustomFetch
      }>()

      return result
    })
    .server(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{
        fromServer1: string
        fromServer2: string
      }>()

      const result = await options.next({
        context: { fromServer3: 'fromServer3' },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        '~types': {
          context: {
            fromServer3: string
          }
          sendContext: undefined
        }
        context: {
          fromServer1: string
          fromServer2: string
          fromServer3: string
        }
        sendContext: undefined
      }>()

      return result
    })

  const middleware4 = createMiddleware({ type: 'function' })
    .middleware([middleware3])
    .client(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{
        fromClient1: string
        fromClient2: string
        fromClient3: string
      }>()

      const result = await options.next({
        context: { fromClient4: 'fromClient4' },
        sendContext: { toServer1: 'toServer1' },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        context: {
          fromClient1: string
          fromClient2: string
          fromClient3: string
          fromClient4: string
        }
        sendContext: { toServer1: 'toServer1' }
        headers: HeadersInit
        fetch?: CustomFetch
      }>()

      return result
    })
    .server(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{
        fromServer1: string
        fromServer2: string
        fromServer3: string
        toServer1: 'toServer1'
      }>()

      const result = await options.next({
        context: { fromServer4: 'fromServer4' },
        sendContext: { toClient1: 'toClient1' },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        '~types': {
          context: {
            fromServer4: string
          }
          sendContext: {
            toClient1: 'toClient1'
          }
        }
        context: {
          fromServer1: string
          fromServer2: string
          fromServer3: string
          fromServer4: string
          toServer1: 'toServer1'
        }
        sendContext: { toClient1: 'toClient1' }
      }>()

      return result
    })

  createMiddleware({ type: 'function' })
    .middleware([middleware4])
    .client(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{
        fromClient1: string
        fromClient2: string
        fromClient3: string
        fromClient4: string
      }>()

      const result = await options.next({
        context: { fromClient5: 'fromClient5' },
        sendContext: { toServer2: 'toServer2' },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        context: {
          fromClient1: string
          fromClient2: string
          fromClient3: string
          fromClient4: string
          fromClient5: string
          toClient1: 'toClient1'
        }
        sendContext: { toServer1: 'toServer1'; toServer2: 'toServer2' }
        headers: HeadersInit
        fetch?: CustomFetch
      }>()

      return result
    })
    .server(async (options) => {
      expectTypeOf(options.context).toEqualTypeOf<{
        fromServer1: string
        fromServer2: string
        fromServer3: string
        fromServer4: string
        toServer1: 'toServer1'
        toServer2: 'toServer2'
      }>()

      const result = await options.next({
        context: { fromServer5: 'fromServer5' },
        sendContext: { toClient2: 'toClient2' },
      })

      expectTypeOf(result).toEqualTypeOf<{
        'use functions must return the result of next()': true
        '~types': {
          context: {
            fromServer5: string
          }
          sendContext: {
            toClient2: 'toClient2'
          }
        }
        context: {
          fromServer1: string
          fromServer2: string
          fromServer3: string
          fromServer4: string
          fromServer5: string
          toServer1: 'toServer1'
          toServer2: 'toServer2'
        }
        sendContext: { toClient1: 'toClient1'; toClient2: 'toClient2' }
      }>()

      return result
    })
})

test('createMiddleware sendContext cannot send a function', () => {
  createMiddleware({ type: 'function' })
    .client(({ next }) => {
      expectTypeOf(next<{ func: () => 'func' }>)
        .parameter(0)
        .exclude<undefined>()
        .toHaveProperty('sendContext')
        .toEqualTypeOf<
          | { func: SerializationError<'Function may not be serializable'> }
          | undefined
        >()

      return next()
    })
    .server(({ next }) => {
      expectTypeOf(next<undefined, { func: () => 'func' }>)
        .parameter(0)
        .exclude<undefined>()
        .toHaveProperty('sendContext')
        .toEqualTypeOf<
          | { func: SerializationError<'Function may not be serializable'> }
          | undefined
        >()

      return next()
    })
})

test('createMiddleware cannot validate function', () => {
  const validator = createMiddleware({ type: 'function' }).validator<
    (input: { func: () => 'string' }) => { output: 'string' }
  >

  expectTypeOf(validator)
    .parameter(0)
    .toEqualTypeOf<
      ConstrainValidator<
        Register,
        'GET',
        (input: { func: () => 'string' }) => { output: 'string' }
      >
    >()
})

test('createMiddleware can validate Date', () => {
  const validator = createMiddleware({ type: 'function' }).validator<
    (input: Date) => { output: 'string' }
  >

  expectTypeOf(validator)
    .parameter(0)
    .toEqualTypeOf<
      ConstrainValidator<Register, 'GET', (input: Date) => { output: 'string' }>
    >()
})

test('createMiddleware can validate FormData', () => {
  const validator = createMiddleware({ type: 'function' }).validator<
    (input: FormData) => { output: 'string' }
  >

  expectTypeOf(validator)
    .parameter(0)
    .toEqualTypeOf<
      ConstrainValidator<
        Register,
        'GET',
        (input: FormData) => { output: 'string' }
      >
    >()
})

test('createMiddleware merging from parent with undefined validator', () => {
  const middleware1 = createMiddleware({ type: 'function' }).validator(
    (input: { test: string }) => input.test,
  )

  createMiddleware({ type: 'function' })
    .middleware([middleware1])
    .server((ctx) => {
      expectTypeOf(ctx.data).toEqualTypeOf<string>()

      return ctx.next()
    })
})

test('createMiddleware validator infers unknown for default input type', () => {
  createMiddleware({ type: 'function' })
    .validator((input) => {
      expectTypeOf(input).toEqualTypeOf<unknown>()

      if (typeof input === 'number') return 'success' as const

      return 'failed' as const
    })
    .server(({ data, next }) => {
      expectTypeOf(data).toEqualTypeOf<'success' | 'failed'>()

      return next()
    })
})

test('createMiddleware with type request, no middleware or context', () => {
  createMiddleware({ type: 'request' }).server(async (options) => {
    expectTypeOf(options).toEqualTypeOf<{
      request: Request
      next: RequestServerNextFn<{}, undefined>
      pathname: string
      context: undefined
      handlerType: 'serverFn' | 'router'
      serverFnMeta?: ServerFnMeta
    }>()

    const result = await options.next()

    expectTypeOf(result).toEqualTypeOf<{
      context: undefined
      pathname: string
      request: Request
      response: Response
    }>()

    return result
  })
})

test('createMiddleware with type request, no middleware with context', () => {
  createMiddleware({ type: 'request' }).server(async (options) => {
    expectTypeOf(options).toEqualTypeOf<{
      request: Request
      next: RequestServerNextFn<{}, undefined>
      pathname: string
      context: undefined
      handlerType: 'serverFn' | 'router'
      serverFnMeta?: ServerFnMeta
    }>()

    const result = await options.next({ context: { a: 'a' } })

    expectTypeOf(result).toEqualTypeOf<{
      context: { a: string }
      pathname: string
      request: Request
      response: Response
    }>()

    return result
  })
})

test('createMiddleware with type request, middleware and context', () => {
  const middleware1 = createMiddleware({ type: 'request' }).server(
    async (options) => {
      expectTypeOf(options).toEqualTypeOf<{
        request: Request
        next: RequestServerNextFn<{}, undefined>
        pathname: string
        context: undefined
        handlerType: 'serverFn' | 'router'
        serverFnMeta?: ServerFnMeta
      }>()

      const result = await options.next({ context: { a: 'a' } })

      expectTypeOf(result).toEqualTypeOf<{
        context: { a: string }
        pathname: string
        request: Request
        response: Response
      }>()

      return result
    },
  )

  createMiddleware({ type: 'request' })
    .middleware([middleware1])
    .server(async (options) => {
      expectTypeOf(options).toEqualTypeOf<{
        request: Request
        next: RequestServerNextFn<{}, undefined>
        pathname: string
        context: { a: string }
        handlerType: 'serverFn' | 'router'
        serverFnMeta?: ServerFnMeta
      }>()

      const result = await options.next({ context: { b: 'b' } })

      expectTypeOf(result).toEqualTypeOf<{
        context: { a: string; b: string }
        pathname: string
        request: Request
        response: Response
      }>()

      return result
    })
})

test('createMiddleware with type request can return Response directly', () => {
  createMiddleware({ type: 'request' }).server(async (options) => {
    expectTypeOf(options).toEqualTypeOf<{
      request: Request
      next: RequestServerNextFn<{}, undefined>
      pathname: string
      context: undefined
      handlerType: 'serverFn' | 'router'
      serverFnMeta?: ServerFnMeta
    }>()

    // Should be able to return a Response directly
    if (Math.random() > 0.5) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Or return the result from next()
    return options.next()
  })
})

test('createMiddleware with type request can return Promise<Response>', () => {
  createMiddleware({ type: 'request' }).server(async (options) => {
    expectTypeOf(options).toEqualTypeOf<{
      request: Request
      next: RequestServerNextFn<{}, undefined>
      pathname: string
      context: undefined
      handlerType: 'serverFn' | 'router'
      serverFnMeta?: ServerFnMeta
    }>()

    // Should be able to return a Promise<Response>
    return Promise.resolve(new Response('OK', { status: 200 }))
  })
})

test('createMiddleware with type request can return sync Response', () => {
  createMiddleware({ type: 'request' }).server((options) => {
    expectTypeOf(options).toEqualTypeOf<{
      request: Request
      next: RequestServerNextFn<{}, undefined>
      pathname: string
      context: undefined
      handlerType: 'serverFn' | 'router'
      serverFnMeta?: ServerFnMeta
    }>()

    // Should be able to return a synchronous Response
    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  })
})
