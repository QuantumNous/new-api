/**
 * This module is marked as server-only via the marker import.
 * Importing it from the client environment should trigger a violation.
 */
import '@tanstack/react-start/server-only'

export const SERVER_ONLY_DATA = 'only-on-server'

export function getServerOnlyData() {
  return SERVER_ONLY_DATA
}
