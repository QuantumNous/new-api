/**
 * This file contains a secret that should only be available on the server.
 * It uses the `.server.ts` naming convention to mark it as server-only.
 */
export const SECRET_KEY = 'super-secret-server-key-12345'

export function getSecret() {
  return SECRET_KEY
}
