/**
 * Middleware that logs server function calls.
 * This is exported through a barrel file that also re-exports type-only modules.
 */
import { createMiddleware } from '@tanstack/react-start'

export const loggingMiddleware = createMiddleware().server(({ next }) => {
  console.log('[logging] Server function called')
  return next()
})
