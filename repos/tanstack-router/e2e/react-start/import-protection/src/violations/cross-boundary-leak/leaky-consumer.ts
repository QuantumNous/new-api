import { getSharedData } from './shared-util'

// Leaky: uses the shared utility OUTSIDE any compiler boundary.
// This must still trigger a violation in the client environment
// even if safe-consumer.ts already loaded shared-util.ts via
// a fetchModule chain that silenced its resolveId.
export function leakyGetSharedData() {
  return getSharedData()
}
