/**
 * This file contains browser-only APIs.
 * It uses the `.client.ts` naming convention to mark it as client-only.
 *
 * Importing it from the server (SSR) environment should trigger a file-based
 * violation because the default server deny rules include `**\/*.client.*`.
 */
export function getBrowserTitle() {
  return typeof document !== 'undefined' ? document.title : 'no-document'
}
