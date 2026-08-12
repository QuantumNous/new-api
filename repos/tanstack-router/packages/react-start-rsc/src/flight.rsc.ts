/**
 * Low-level Flight stream API for RSC (React Server Components) environment.
 *
 * This exports renderToReadableStream which generates a Flight stream from
 * React elements. Only available in RSC context (react-server condition).
 *
 * @example
 * ```tsx
 * import { renderToReadableStream } from '@tanstack/react-start/rsc'
 *
 * const stream = renderToReadableStream(<MyServerComponent />)
 * return new Response(stream, {
 *   headers: { 'Content-Type': 'text/x-component' }
 * })
 * ```
 */
export { renderToReadableStream } from 'virtual:tanstack-rsc-runtime'
