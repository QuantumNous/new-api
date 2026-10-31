/**
 * Intermediate module that re-exports from the client-only marked module.
 * This creates a 2-hop import chain in the server environment:
 *   route -> marked-client-only-edge.ts -> marked-client-only.ts
 */
import { getClientOnlyData } from './marked-client-only'

export function getClientOnlyDataViaEdge() {
  return getClientOnlyData()
}
