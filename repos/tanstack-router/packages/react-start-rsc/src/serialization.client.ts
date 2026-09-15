import { createSerializationAdapter } from '@tanstack/react-router'
// RSC HMR setup (dev-only, provided by the active Start bundler adapter).
import { setupRscHmr } from 'virtual:tanstack-rsc-hmr'
import {
  createCompositeFromStream,
  createRenderableFromStream,
} from './createServerComponentFromStream'
import type {
  AnyCompositeComponent,
  RscSlotUsageEvent,
} from './ServerComponentTypes'

if (process.env.NODE_ENV === 'development') {
  setupRscHmr()
}

/**
 * Client-side serialization adapter for RSC (renderable + composite).
 */
type SerializedRsc = {
  kind: 'renderable' | 'composite'
  stream: ReadableStream<Uint8Array>
  slotUsagesStream?: ReadableStream<RscSlotUsageEvent>
  cssHrefs?: Array<string>
  jsPreloads?: Array<string>
}

const adapter = createSerializationAdapter({
  key: '$RSC',
  test: (_value: unknown): _value is never => false,
  toSerializable: (): never => {
    throw new Error('RSC cannot be serialized on client')
  },
  fromSerializable: (value: SerializedRsc): AnyCompositeComponent => {
    // Rsbuild SSR sends asset deps with each serialized RSC so the client can
    // preload only if that specific stream is rendered. When absent, decode
    // starts eagerly and discovers assets from the Flight payload as before.
    const options = {
      cssHrefs: value.cssHrefs,
      jsPreloads: value.jsPreloads,
    }

    if (value.kind === 'renderable') {
      return createRenderableFromStream(value.stream, options)
    }

    return createCompositeFromStream(value.stream, {
      slotUsagesStream: value.slotUsagesStream,
      ...options,
    })
  },
})

export const rscSerializationAdapter = () => [adapter]
