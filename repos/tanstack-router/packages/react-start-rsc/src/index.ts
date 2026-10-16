// Default exports (used by client bundles and SSR)
// This file is used when importing outside of RSC (React Server Components) context

// Types are always available
export type {
  AnyCompositeComponent,
  AnyRenderableServerComponent,
  RenderableServerComponent,
  RenderableServerComponentAttributes,
  RenderableServerComponentBuilder,
} from './ServerComponentTypes'

// CSS hrefs symbol for type-safe access
export { SERVER_COMPONENT_CSS_HREFS } from './ServerComponentTypes'

// Stubs for RSC-only functions - throw if called outside RSC context
export { renderServerComponent } from './renderServerComponent.stub.js'
export { createCompositeComponent } from './createCompositeComponent.stub.js'

// Renderer for composite RSC data (client/SSR)
export { CompositeComponent } from './CompositeComponent.js'

// Low-level Flight stream APIs (client/SSR)
export { createFromReadableStream, createFromFetch } from './flight'

// Stub for renderToReadableStream - throws if called outside RSC context
export { renderToReadableStream } from './flight.stub.js'

// Note: rscSerializationAdapter is intentionally NOT exported here.
// It imports virtual:tanstack-rsc-hmr which is client-only (not available in SSR).
// Import directly from '@tanstack/react-start-rsc/serialization.client' or
// '@tanstack/react-start-rsc/serialization.server' as needed.
