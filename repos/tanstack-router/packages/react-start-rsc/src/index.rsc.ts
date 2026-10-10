// Server-side exports (react-server condition)
// This file is used when importing from RSC (React Server Components) context

// Types are always available
export type {
  AnyCompositeComponent,
  AnyRenderableServerComponent,
  RenderableServerComponent,
  RenderableServerComponentAttributes,
  RenderableServerComponentBuilder,
} from './ServerComponentTypes'

// New API: renderServerComponent - renders element to renderable proxy
export { renderServerComponent } from './renderServerComponent.js'

// New API: createCompositeComponent - creates composite with slot support
export { createCompositeComponent } from './createCompositeComponent.js'

// Renderer for composite RSC data (client/SSR)
export { CompositeComponent } from './CompositeComponent.js'

// Low-level Flight stream API (RSC only)
export { renderToReadableStream } from './flight.rsc.js'

// Low-level Flight stream APIs (also available in RSC for decode operations)
export { createFromReadableStream, createFromFetch } from './flight'

// Note: rscSerializationAdapter is intentionally NOT exported here.
// It uses createSerializationAdapter from react-router which is marked as
// client-only in RSC environment. The adapter is only needed by SSR/client
// for serializing/deserializing server components, not by RSC itself.
