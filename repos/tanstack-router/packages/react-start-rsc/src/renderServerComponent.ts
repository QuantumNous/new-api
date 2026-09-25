import { renderToReadableStream } from 'virtual:tanstack-rsc-runtime'
import { getRequest } from '@tanstack/start-server-core'
import { getStartContext } from '@tanstack/start-storage-context'
import { ReplayableStream } from './ReplayableStream'
import { RENDERABLE_RSC, SERVER_COMPONENT_STREAM } from './ServerComponentTypes'
import { createRscCssEnvelope } from './rscCssEnvelope'
import type {
  AnyRenderableServerComponent,
  RenderableServerComponentBuilder,
  ServerComponentStream,
  ValidateRenderableServerComponent,
} from './ServerComponentTypes'
import type { RscCssEnvelopeOptions } from './rscCssEnvelope'

import './rscSsrHandler'
// Import for global declaration side effect
export type { RscSsrHandler, RscDecodeResult } from './rscSsrHandler'

/**
 * Renderable RSC handle type - used for serialization detection.
 */

/**
 * Type guard for renderable RSC handle.
 */
export function isRenderableRscHandle(
  value: unknown,
): value is AnyRenderableServerComponent {
  return (
    typeof value === 'function' &&
    SERVER_COMPONENT_STREAM in value &&
    RENDERABLE_RSC in value &&
    (value as any)[RENDERABLE_RSC] === true
  )
}

/**
 * Renders a React element to an RSC Flight stream.
 *
 * Returns a "renderable proxy" that can be:
 * - Rendered directly as `{data}` in JSX
 * - Accessed for nested selections: `{data.foo.bar.Hello}`
 *
 * No slot support - for slots use `createCompositeComponent`.
 *
 * @example
 * ```tsx
 * // In a loader or server function
 * const data = await renderServerComponent(<MyServerComponent foo="bar" />)
 *
 * // In the route component
 * return (
 *   <div>
 *     {data}
 *     {data.sidebar.Menu}
 *   </div>
 * )
 * ```
 */
export async function renderServerComponent<TNode>(
  node: ValidateRenderableServerComponent<TNode>,
  options?: RscCssEnvelopeOptions,
): Promise<RenderableServerComponentBuilder<TNode>> {
  const flightStream = renderToReadableStream(
    createRscCssEnvelope(node, options),
  )

  // Check if this is an SSR request (router) or a direct server function call
  const ctx = getStartContext({ throwIfNotFound: false })
  const isRouterRequest = ctx?.handlerType === 'router'
  const ssrHandler = globalThis.__RSC_SSR__

  // SSR path: buffer stream for replay, pre-decode for synchronous rendering
  if (isRouterRequest && ssrHandler) {
    const signal = getRequest().signal
    const stream = new ReplayableStream(flightStream, { signal })

    // Pre-decode during loader phase for synchronous SSR rendering
    const decoded = await ssrHandler.decode(stream)
    return ssrHandler.createRenderableProxy(
      stream,
      decoded,
    ) as RenderableServerComponentBuilder<TNode>
  }

  // Server function call path: return a handle for serialization
  return createRenderableHandle(
    flightStream,
  ) as unknown as RenderableServerComponentBuilder<TNode>
}

/**
 * Creates a renderable handle for server function responses.
 * Tagged with RENDERABLE_RSC for the serialization adapter.
 */
function createRenderableHandle(
  flightStream: ReadableStream<Uint8Array>,
): AnyRenderableServerComponent {
  const streamWrapper: ServerComponentStream = {
    createReplayStream: () => flightStream,
  }

  const stub = function RenderableRscStub(): never {
    throw new Error(
      'Renderable RSC from server function cannot be rendered on server. ' +
        'It should be serialized and sent to the client.',
    )
  }

  ;(stub as any)[SERVER_COMPONENT_STREAM] = streamWrapper
  ;(stub as any)[RENDERABLE_RSC] = true
  return stub as unknown as AnyRenderableServerComponent
}
