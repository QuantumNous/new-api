import {
  createStart,
  createMiddleware,
  createServerOnlyFn,
} from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

// Use a WeakMap keyed by Request object for request-scoped tracking
// This is cleaner than global state and automatically garbage collects
const requestMiddlewareCounts = new WeakMap<Request, Record<string, number>>()

// Helper to track middleware execution - attaches to the Request object
// This is server-only since it uses getRequest()
export const trackMiddlewareExecution = createServerOnlyFn(
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
// Wrapped in createServerOnlyFn since it uses getRequest()
export const getMiddlewareExecutionCounts = createServerOnlyFn(
  (): Record<string, number> => {
    const request = getRequest()
    return requestMiddlewareCounts.get(request) || {}
  },
)

// This is the middleware from issue #5239 - it's registered as BOTH:
// 1. Global request middleware (in startInstance)
// 2. Server function middleware (attached to individual server functions)
// The bug is that it executes multiple times instead of being deduped
export const loggingMiddleware = createMiddleware().server(async ({ next }) => {
  trackMiddlewareExecution('loggingMiddleware')
  return next({
    context: {
      loggingMiddlewareExecuted: true,
    },
  })
})

// Regression test for #6647: verify that pathname is correctly passed to
// global request middleware by createStartHandler
export const pathnameMiddleware = createMiddleware().server(
  async ({ next, pathname }) => {
    return next({
      context: {
        requestMiddlewarePathname: pathname,
      },
    })
  },
)

export const trustedUserMiddleware = createMiddleware().server(
  async ({ next }) => {
    return next({
      context: {
        trustedUser: 'server-user',
      },
    })
  },
)

// Global function middleware that should be deduped across server functions
export const globalFunctionMiddleware = createMiddleware({
  type: 'function',
}).server(async ({ next }) => {
  trackMiddlewareExecution('globalFunctionMiddleware')
  return next({
    context: {
      globalMiddlewareExecuted: true,
    },
  })
})

// A second global middleware to test multiple global middlewares
export const globalFunctionMiddleware2 = createMiddleware({
  type: 'function',
}).server(async ({ next }) => {
  trackMiddlewareExecution('globalFunctionMiddleware2')
  return next({
    context: {
      globalMiddleware2Executed: true,
    },
  })
})

// Create the start instance with global middleware
export const startInstance = createStart(() => ({
  // Global function middleware that applies to all server functions
  functionMiddleware: [globalFunctionMiddleware, globalFunctionMiddleware2],
  // Request middleware - includes loggingMiddleware (issue #5239 scenario)
  // AND the same loggingMiddleware is also attached to server functions
  requestMiddleware: [
    trustedUserMiddleware,
    loggingMiddleware,
    pathnameMiddleware,
  ],
}))
