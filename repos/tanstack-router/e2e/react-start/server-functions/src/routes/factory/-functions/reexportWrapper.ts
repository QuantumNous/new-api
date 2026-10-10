import { createMiddleware, createServerFn } from '@tanstack/react-start'

const reexportMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    console.log('reexport middleware triggered')
    return next({
      context: { reexport: 'reexport-middleware-executed' } as const,
    })
  },
)

export const reexportFactory = createServerFn().middleware([reexportMiddleware])
