/**
 * This file contains browser-only APIs.
 * It uses the custom `.frontend.ts` naming convention (NOT the default
 * `.client.ts`) to mark it as client-only.
 *
 * The vite config denies `**\/*.frontend.*` in the server (SSR) environment.
 */
export function getBrowserInfo() {
  return typeof window !== 'undefined' ? window.location.href : 'no-window'
}
