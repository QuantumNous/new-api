import { getRequest } from '@tanstack/react-start/server'

// This utility wraps a denied server import and is used in a route's
// `beforeLoad` hook.  `beforeLoad` is NOT in the compiler's
// splitRouteIdentNodes or deleteNodes lists, so it survives on the client.
// Using this module in `beforeLoad` is therefore a TRUE POSITIVE violation.
export function getSessionFromRequest() {
  const req = getRequest()
  return { sessionId: req.headers.get('x-session-id') }
}
