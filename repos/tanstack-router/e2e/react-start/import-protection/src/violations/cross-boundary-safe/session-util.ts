import { getRequest } from '@tanstack/react-start/server'

// This utility wraps a denied server import but does NOT contain any
// compiler boundaries.  All consumers use it ONLY inside compiler
// boundaries (createServerFn().handler, createMiddleware().server, etc.)
// so the compiler should prune this import from the client bundle.
//
// This mirrors the real-world pattern of a session utility that wraps
// `useSession` from `@tanstack/react-start/server`.
export function getSessionData() {
  const req = getRequest()
  return { method: req.method }
}
