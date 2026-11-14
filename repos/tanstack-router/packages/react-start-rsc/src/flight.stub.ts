/**
 * Client stub for renderToReadableStream.
 *
 * This function should never be called at runtime on the client.
 * It exists only to provide types for bundler imports in client bundles.
 * The real implementation only runs inside RSC context (server functions).
 */
export function renderToReadableStream(
  _node: React.ReactNode,
): ReadableStream<Uint8Array> {
  throw new Error(
    'renderToReadableStream cannot be called on the client. ' +
      'This function should only be called inside RSC context (server functions).',
  )
}
