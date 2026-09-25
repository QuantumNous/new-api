import { createMiddleware } from '@tanstack/solid-start'
import { createFooServerFn } from './createFooServerFn'

const barMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    console.log('Bar middleware triggered')
    return next({
      context: { bar: 'bar' } as const,
    })
  },
)

export const createBarServerFn = createFooServerFn().middleware([barMiddleware])

export const barFnInsideFactoryFile = createBarServerFn().handler(
  ({ context, method }) => {
    return {
      name: 'barFnInsideFactoryFile',
      context,
      method,
    }
  },
)
