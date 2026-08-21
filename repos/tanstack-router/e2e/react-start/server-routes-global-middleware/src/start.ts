import {
  createIsomorphicFn,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

// Use a WeakMap keyed by Request object for request-scoped tracking
const requestMiddlewareCounts = new WeakMap<Request, Record<string, number>>()

// Helper to track middleware execution - only runs on server
export const trackMiddlewareExecution = createIsomorphicFn().server(
  (middlewareName: string) => {
    const request = getRequest()
    let counts = requestMiddlewareCounts.get(request)
    if (!counts) {
      counts = {}
      requestMiddlewareCounts.set(request, counts)
    }
    counts[middlewareName] = (counts[middlewareName] || 0) + 1
    console.log(
      `[MIDDLEWARE] ${middlewareName} executed. Count: ${counts[middlewareName]}`,
    )
    return counts[middlewareName]
  },
)

// Helper to get execution counts for the current request
// Uses createIsomorphicFn so it can be called in beforeLoad without crashing on client
// Returns undefined on client (no .client() impl), returns counts on server
export const getMiddlewareExecutionCounts = createIsomorphicFn().server(
  (): Record<string, number> => {
    const request = getRequest()
    return requestMiddlewareCounts.get(request) || {}
  },
)

// This middleware is registered as BOTH:
// 1. Global request middleware (in startInstance)
// 2. Server route middleware (attached to individual routes)
// The bug would be that it executes multiple times instead of being deduped
export const loggingMiddleware = createMiddleware().server(async ({ next }) => {
  trackMiddlewareExecution('loggingMiddleware')
  return next({
    context: {
      loggingMiddlewareExecuted: true,
      loggingMiddlewareTimestamp: Date.now(),
    },
  })
})

// Another global middleware for testing
export const authMiddleware = createMiddleware().server(async ({ next }) => {
  trackMiddlewareExecution('authMiddleware')
  return next({
    context: {
      authMiddlewareExecuted: true,
      userId: 'test-user-123',
    },
  })
})

// Create the start instance with global request middleware
export const startInstance = createStart(() => ({
  // Global request middleware - applies to all requests
  requestMiddleware: [loggingMiddleware, authMiddleware],
}))
