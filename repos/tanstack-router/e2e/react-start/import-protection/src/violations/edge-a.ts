/**
 * Intermediate module that re-exports from the server-only file.
 * This creates a 2-hop import chain:
 *   index.tsx -> edge-a.ts -> secret.server.ts
 */
import { getSecret } from './secret.server'

export function getWrappedSecret() {
  return getSecret()
}
