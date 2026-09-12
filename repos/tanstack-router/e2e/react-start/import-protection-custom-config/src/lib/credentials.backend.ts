/**
 * This file contains a secret that should only be available on the server.
 * It uses the custom `.backend.ts` naming convention (NOT the default
 * `.server.ts`) to mark it as server-only.
 *
 * The vite config denies `**\/*.backend.*` in the client environment.
 */
export const SECRET_KEY = 'custom-backend-secret-99999'

export function getBackendSecret() {
  return SECRET_KEY
}
