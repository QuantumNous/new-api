import { createMiddleware } from '@tanstack/react-start'

// Middleware factory function - returns a middleware with .server() call
export function createPublicRateLimitMiddleware(keySuffix) {
  return createMiddleware({ type: 'function' }).server(
    async ({ next, data }) => {
      const key = keySuffix ? `ip:${keySuffix}` : 'ip:default'
      const finalKey = typeof data === 'string' ? `ip:${data}` : key

      const { success } = await rateLimit({ key: finalKey })

      if (!success) {
        throw new Error('Too many requests')
      }

      return next()
    },
  )
}

// Arrow function factory
export const createAuthMiddleware = (requiredRole) => {
  return createMiddleware({ type: 'function' }).server(async ({ next }) => {
    const user = await getUser()
    if (!user) {
      throw new Error('Unauthorized')
    }
    if (requiredRole && user.role !== requiredRole) {
      throw new Error('Forbidden')
    }
    return next()
  })
}

// Top-level middleware for comparison
export const topLevelMiddleware = createMiddleware({
  id: 'topLevel',
}).server(async ({ next }) => {
  console.log('top level')
  return next()
})
