/**
 * This file contains a browser-only React component for window dimensions.
 * It uses the `.client.tsx` naming convention to mark it as client-only.
 *
 * Importing it from the server (SSR) environment should trigger a file-based
 * violation because the default server deny rules include `**\/*.client.*`.
 *
 * Because this exports a React component used in JSX, the violation snippet
 * in the importing route will show JSX usage (`<WindowSize />`), triggering
 * the `<ClientOnly>` suggestion.
 */
export function WindowSize() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 0
  const h = typeof window !== 'undefined' ? window.innerHeight : 0
  return (
    <span>
      {w}x{h}
    </span>
  )
}
