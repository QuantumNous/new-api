import { getRequest } from '@tanstack/react-start/server'

// This is intentionally NOT inside a compiler-recognized boundary.
// We want the import to survive compilation and be denied in the client build.
export function leakyGetRequestUsage() {
  // Any reference keeps the import alive.
  return getRequest()
}
