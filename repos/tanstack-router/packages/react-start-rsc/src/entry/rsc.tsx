/**
 * Shared RSC (React Server Components) entry point.
 *
 * This file exports the functions needed for the active RSC environment:
 * - getServerFnById: Resolves server functions by their encoded ID
 * - render: Renders a React node to an RSC Flight stream
 */

import { renderToReadableStream } from 'virtual:tanstack-rsc-runtime'
import type React from 'react'

// Re-export getServerFnById from the virtual module which handles both dev and production
// In dev: dynamic import with base64url-decoded file path
// In production: manifest-based lookup with bundled chunks
export { getServerFnById } from '#tanstack-start-server-fn-resolver'

/**
 * Renders a React node to an RSC Flight stream.
 * Used internally for streaming server component output.
 */
export function render(node: React.ReactNode): ReadableStream<Uint8Array> {
  return renderToReadableStream(node)
}
