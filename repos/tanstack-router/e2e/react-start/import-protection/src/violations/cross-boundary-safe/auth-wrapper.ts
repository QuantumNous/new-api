import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { getSessionData } from './session-util'

// This middleware uses the session utility inside a compiler boundary.
// The compiler should strip the import of session-util from the client.
const authMiddleware = createMiddleware({ type: 'function' }).server(
  ({ next }) => {
    const data = getSessionData()
    return next({ context: { session: data } })
  },
)

// Exports a pre-configured server fn with the middleware attached.
// This mirrors the real-world `createAuthServerFn` pattern.
export const createAuthServerFn = createServerFn().middleware([authMiddleware])
