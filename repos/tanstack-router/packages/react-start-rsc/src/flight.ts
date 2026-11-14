/**
 * Low-level Flight stream APIs for decoding RSC streams.
 *
 * These functions provide direct access to RSC Flight stream decoding,
 * allowing advanced use cases like:
 * - Server functions returning raw Flight Response
 * - API routes streaming Flight payloads
 * - Custom Flight stream handling via RawStream
 *
 * `createFromReadableStream` works in both SSR and browser contexts.
 * `createFromFetch` is browser-only.
 *
 * NOTE: Dynamic imports keep decode initialisation runtime-specific. The
 * concrete implementation comes from bundler-owned virtual modules.
 */

import {
  createClientOnlyFn,
  createIsomorphicFn,
} from '@tanstack/start-fn-stubs'

/**
 * Decode a Flight stream into React elements.
 * Works in both SSR and browser contexts.
 *
 * @example
 * ```tsx
 * const rawStream = await getRscRawStream()
 * const tree = await createFromReadableStream(rawStream)
 * return <>{tree}</>
 * ```
 */
export const createFromReadableStream = createIsomorphicFn()
  .server(
    async (stream: ReadableStream<Uint8Array>): Promise<React.ReactNode> => {
      const { createFromReadableStream: decode } =
        await import('virtual:tanstack-rsc-ssr-decode')
      return decode(stream) as React.ReactNode
    },
  )
  .client(
    async (stream: ReadableStream<Uint8Array>): Promise<React.ReactNode> => {
      const { createFromReadableStream: decode } =
        await import('virtual:tanstack-rsc-browser-decode')
      return decode(stream)
    },
  )

/**
 * Decode a Flight stream from a fetch Response.
 * Browser only - will throw if called on the server.
 *
 * @example
 * ```tsx
 * // From server function returning raw Response
 * const tree = await createFromFetch(getFlightResponse())
 *
 * // From API route
 * const tree = await createFromFetch(fetch('/api/rsc-flight'))
 * ```
 */
export const createFromFetch = createClientOnlyFn(
  async (fetchPromise: Promise<Response>): Promise<React.ReactNode> => {
    const { createFromFetch: decode } =
      await import('virtual:tanstack-rsc-browser-decode')
    return decode(fetchPromise)
  },
)
