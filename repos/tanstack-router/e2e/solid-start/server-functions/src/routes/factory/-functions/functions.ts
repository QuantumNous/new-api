import { createMiddleware, createServerFn } from '@tanstack/solid-start'
import { createBarServerFn } from './createBarServerFn'
import { createFooServerFn } from './createFooServerFn'
import { createFakeFn } from './createFakeFn'

export const fooFn = createFooServerFn().handler(({ context, method }) => {
  return {
    name: 'fooFn',
    context,
    method,
  }
})

export const fooFnPOST = createFooServerFn({ method: 'POST' }).handler(
  ({ context, method }) => {
    return {
      name: 'fooFnPOST',
      context,
      method,
    }
  },
)

export const barFn = createBarServerFn().handler(({ context, method }) => {
  return {
    name: 'barFn',
    context,
    method,
  }
})

export const barFnPOST = createBarServerFn({ method: 'POST' }).handler(
  ({ context, method }) => {
    return {
      name: 'barFnPOST',
      context,
      method,
    }
  },
)

const localMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    console.log('local middleware triggered')
    return next({
      context: { local: 'local' } as const,
    })
  },
)

const localFnFactory = createBarServerFn.middleware([localMiddleware])

const anotherMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    console.log('another middleware triggered')
    return next({
      context: { another: 'another' } as const,
    })
  },
)

export const localFn = localFnFactory()
  .middleware([anotherMiddleware])
  .handler(({ context, method }) => {
    return {
      name: 'localFn',
      context,
      method,
    }
  })

export const localFnPOST = localFnFactory({ method: 'POST' })
  .middleware([anotherMiddleware])
  .handler(({ context, method }) => {
    return {
      name: 'localFnPOST',
      context,
      method,
    }
  })

export const fakeFn = createFakeFn().handler(async () => {
  return {
    name: 'fakeFn',
    window,
  }
})

export const composeFactory = createServerFn({ method: 'GET' }).middleware([
  createBarServerFn,
])
export const composedFn = composeFactory()
  .middleware([anotherMiddleware, localFnFactory])
  .handler(({ context, method }) => {
    return {
      name: 'composedFn',
      context,
      method,
    }
  })
