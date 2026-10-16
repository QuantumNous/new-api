import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

const fooMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    const request = getRequest()
    console.log('Foo middleware triggered')
    return next({
      context: { foo: 'foo', method: request.method } as const,
    })
  },
)

export const createFooServerFn = createServerFn().middleware([fooMiddleware])

export const fooFnInsideFactoryFile = createFooServerFn().handler(
  async ({ context, method }) => {
    console.log('fooFnInsideFactoryFile handler triggered', context.method)
    return {
      name: 'fooFnInsideFactoryFile',
      context,
      method,
    }
  },
)
