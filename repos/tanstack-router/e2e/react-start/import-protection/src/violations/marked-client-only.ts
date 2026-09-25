/**
 * This module is marked as client-only via the marker import.
 * Importing it from the server (SSR) environment should trigger a marker violation.
 */
import '@tanstack/react-start/client-only'

export const CLIENT_ONLY_DATA = 'only-on-client'

export function getClientOnlyData() {
  return CLIENT_ONLY_DATA
}
