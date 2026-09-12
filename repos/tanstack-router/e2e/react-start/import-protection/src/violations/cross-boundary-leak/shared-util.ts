import { getRequest } from '@tanstack/react-start/server'

// Utility that wraps a denied server import.  It is consumed by BOTH a
// safe consumer (inside compiler boundaries) AND a leaky consumer (outside
// any boundary).  The leaky consumer must still trigger a violation even
// if the safe consumer's fetchModule chain silences the initial resolve.
export function getSharedData() {
  const req = getRequest()
  return { method: req.method }
}
