/**
 * This is the deepest module in the nested re-export chain.
 * It defines a server function factory with middleware.
 *
 * Chain: nestedReexportA -> nestedReexportB -> nestedReexportC (this file)
 */
import { createMiddleware, createServerFn } from '@tanstack/react-start'

const nestedMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    console.log('nested middleware triggered')
    return next({
      context: { nested: 'nested-middleware-executed' } as const,
    })
  },
)

export const nestedReexportFactory = createServerFn({
  method: 'GET',
}).middleware([nestedMiddleware])
