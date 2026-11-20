import type {
  RscSlotUsageEvent,
  ServerComponentStream,
} from './ServerComponentTypes'

/**
 * Result from decoding an RSC stream for SSR.
 */
export interface RscDecodeResult {
  tree: unknown
  cssHrefs?: Set<string>
  jsPreloads?: Set<string>
}

/**
 * SSR handler interface - registered by serialization.server.ts in SSR environment.
 * Supports both renderable and composite proxy creation.
 */
export interface RscSsrHandler {
  /** Pre-decode the stream for synchronous SSR rendering */
  decode: (stream: ServerComponentStream) => Promise<RscDecodeResult>
  /** Create a renderable proxy (for renderServerComponent) */
  createRenderableProxy: (
    stream: ServerComponentStream,
    decoded: RscDecodeResult,
  ) => any
  /** Create a composite proxy (for createCompositeComponent) */
  createCompositeProxy: (
    stream: ServerComponentStream,
    decoded: RscDecodeResult,
    slotUsagesStream?: ReadableStream<RscSlotUsageEvent>,
  ) => any
}

// Single global for SSR environment communication
declare global {
  // eslint-disable-next-line no-var
  var __RSC_SSR__: RscSsrHandler | undefined
}
