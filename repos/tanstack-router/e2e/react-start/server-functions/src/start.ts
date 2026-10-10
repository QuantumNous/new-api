import { createCsrfMiddleware, createStart } from '@tanstack/react-start'
import type { CustomFetch } from '@tanstack/react-start'

/**
 * Global custom fetch implementation for all server functions.
 * This adds an 'x-global-fetch' header to all requests, which can be used
 * to verify that the global fetch is being used.
 *
 * This fetch has lower priority than middleware and call-site fetch,
 * so it can be overridden when needed.
 */
const globalServerFnFetch: CustomFetch = (input, init) => {
  const headers = new Headers(init?.headers)
  headers.set('x-global-fetch', 'true')
  return fetch(input, { ...init, headers })
}

export const startInstance = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({
      filter: (ctx) => ctx.handlerType === 'serverFn',
    }),
  ],
  serverFns: {
    fetch: globalServerFnFetch,
  },
}))
