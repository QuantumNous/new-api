import { createMiddleware, createStart } from '@tanstack/vue-start'
import type { GlobalMiddlewareContext } from '../../shared'

function appendTrace(
  trace: string | undefined,
  fallback: string,
  label: string,
) {
  return `${trace ?? fallback}.${label}`
}

const requestMiddlewareA = createMiddleware({ type: 'request' }).server(
  ({ next, context }) => {
    const ctx = (context ?? {}) as GlobalMiddlewareContext

    return next({
      context: {
        requestTrace: appendTrace(ctx.requestTrace, 'req', 'r1'),
        requestTotal: (ctx.requestTotal ?? 0) + 1,
      },
    })
  },
)

const requestMiddlewareB = createMiddleware({ type: 'request' }).server(
  ({ next, context }) => {
    const ctx = (context ?? {}) as GlobalMiddlewareContext

    return next({
      context: {
        requestTrace: appendTrace(ctx.requestTrace, 'req', 'r2'),
        requestTotal: (ctx.requestTotal ?? 0) + 2,
      },
    })
  },
)

const requestMiddlewareC = createMiddleware({ type: 'request' }).server(
  ({ next, context }) => {
    const ctx = (context ?? {}) as GlobalMiddlewareContext

    return next({
      context: {
        requestTrace: appendTrace(ctx.requestTrace, 'req', 'r3'),
        requestTotal: (ctx.requestTotal ?? 0) + 3,
      },
    })
  },
)

const functionMiddlewareA = createMiddleware({ type: 'function' }).server(
  ({ next, context }) => {
    const ctx = (context ?? {}) as GlobalMiddlewareContext

    return next({
      context: {
        functionTrace: appendTrace(ctx.functionTrace, 'fn', 'f1'),
        functionTotal: (ctx.functionTotal ?? 0) + 10,
      },
    })
  },
)

const functionMiddlewareB = createMiddleware({ type: 'function' }).server(
  ({ next, context }) => {
    const ctx = (context ?? {}) as GlobalMiddlewareContext

    return next({
      context: {
        functionTrace: appendTrace(ctx.functionTrace, 'fn', 'f2'),
        functionTotal: (ctx.functionTotal ?? 0) + 20,
      },
    })
  },
)

export const startInstance = createStart(() => ({
  requestMiddleware: [
    requestMiddlewareA,
    requestMiddlewareB,
    requestMiddlewareC,
  ],
  functionMiddleware: [functionMiddlewareA, functionMiddlewareB],
}))
