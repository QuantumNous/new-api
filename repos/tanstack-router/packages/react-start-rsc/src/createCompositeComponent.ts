import { createElement } from 'react'
import { renderToReadableStream } from 'virtual:tanstack-rsc-runtime'
import { getRequest } from '@tanstack/start-server-core'
import { getStartContext } from '@tanstack/start-storage-context'
import { sanitizeSlotArgs } from './slotUsageSanitizer'
import { ReplayableStream } from './ReplayableStream'
import { ClientSlot } from './ClientSlot'
import {
  RSC_SLOT_USAGES_STREAM,
  SERVER_COMPONENT_STREAM,
} from './ServerComponentTypes'
import { createRscCssEnvelope } from './rscCssEnvelope'
import type {
  AnyCompositeComponent,
  CompositeComponentResult,
  RscSlotUsageEvent,
  ServerComponentStream,
  ValidateCompositeComponent,
} from './ServerComponentTypes'
import type { RscCssEnvelopeOptions } from './rscCssEnvelope'

import './rscSsrHandler' // Import for global declaration side effect

/**
 * Creates a composite server component with slot support.
 *
 * Supports returning:
 * - A ReactNode directly
 * - An object structure with ReactNodes: accessed as `src.Foo`
 * - Nested structures: accessed as `src.x.Bar`
 *
 * Props that are functions become slots - they render as ClientSlot placeholders
 * in the RSC output, filled in by the consumer with actual implementations.
 *
 * The returned value is NOT directly renderable. Use `<CompositeComponent src={...} />`.
 *
 * @example
 * ```tsx
 * const src = await createCompositeComponent((props) => (
 *   <div>
 *     <header>{props.header('Dashboard')}</header>
 *     <main>{props.children}</main>
 *   </div>
 * ))
 *
 * // In route component
 * return (
 *   <CompositeComponent src={src} header={(title) => <h1>{title}</h1>}>
 *     <p>Main content</p>
 *   </CompositeComponent>
 * )
 * ```
 */
export async function createCompositeComponent<TComp>(
  component: ValidateCompositeComponent<TComp>,
  options?: RscCssEnvelopeOptions,
): Promise<CompositeComponentResult<TComp>> {
  const isDev = process.env.NODE_ENV === 'development'

  // Dev-only: stream slot usage events (slot + raw args)
  const slotUsagesEmitter = isDev
    ? createReadableStreamEmitter<RscSlotUsageEvent>()
    : null

  // Create a wrapper component that will be rendered inside React's Flight context.
  // This ensures React.cache works properly since the component is called during
  // renderToReadableStream's render phase, not before it.
  const { proxy: proxyProps } = createSlotProxy<{}>({
    onSlotCall: slotUsagesEmitter
      ? (name, args) => {
          const sanitizedArgs = sanitizeSlotArgs(args)
          slotUsagesEmitter.emit({
            slot: name,
            args: sanitizedArgs.length ? sanitizedArgs : undefined,
          })
        }
      : undefined,
  })

  // Wrapper that renders the user's component inside Flight render context
  async function ServerComponentWrapper() {
    return createRscCssEnvelope(
      await (component as React.FC)(proxyProps),
      options,
    )
  }

  // Render using createElement so React calls our component during Flight rendering
  // This is critical for React.cache to work - the component must be invoked
  // during renderToReadableStream's execution, not before
  const flightStream = renderToReadableStream(
    createElement(ServerComponentWrapper as any),
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

    // For SSR we know decode fully consumed the Flight stream.
    slotUsagesEmitter?.close()

    return ssrHandler.createCompositeProxy(
      stream,
      decoded,
      slotUsagesEmitter?.stream,
    ) as CompositeComponentResult<TComp>
  }

  // Server function call path:
  // The serialization adapter will stream to the client.
  const monitoredFlightStream =
    isDev && slotUsagesEmitter
      ? wrapReadableStream(flightStream, {
          onDone: () => {
            slotUsagesEmitter.close()
          },
          onCancel: () => {
            slotUsagesEmitter.close()
          },
          onError: () => {
            slotUsagesEmitter.close()
          },
        })
      : flightStream

  return createCompositeHandle(monitoredFlightStream, {
    slotUsagesStream: slotUsagesEmitter?.stream,
  }) as CompositeComponentResult<TComp>
}

/**
 * Creates a composite handle for server function responses.
 * No proxy needed - the client will decode and create its own proxy.
 */
function createCompositeHandle(
  flightStream: ReadableStream<Uint8Array>,
  options?: {
    slotUsagesStream?: ReadableStream<RscSlotUsageEvent>
  },
): AnyCompositeComponent {
  // Simple single-use stream wrapper. For server function calls, the stream
  // is consumed exactly once by the serialization adapter for transport.
  const streamWrapper: ServerComponentStream = {
    createReplayStream: () => flightStream,
  }

  // Create a stub function with the stream attached for serialization.
  // This will never be rendered directly - it goes through serialization
  // which extracts the stream and sends it to the client.
  const stub = function CompositeComponentStub(): never {
    throw new Error(
      'CompositeComponent from server function cannot be rendered on server. ' +
        'It should be serialized and sent to the client.',
    )
  }

  ;(stub as any)[SERVER_COMPONENT_STREAM] = streamWrapper
  // Note: RENDERABLE_RSC is not set (or implicitly false), indicating this is a composite component

  if (options?.slotUsagesStream) {
    ;(stub as any)[RSC_SLOT_USAGES_STREAM] = options.slotUsagesStream
  }

  return stub as unknown as AnyCompositeComponent
}

/**
 * Base slot props type - functions that become ClientSlot placeholders
 */
interface SlotPropsBase {
  [key: string]:
    | ((...args: Array<any>) => React.ReactNode)
    | React.ReactNode
    | undefined
  children?: React.ReactNode
}

interface SlotProxyResult<TSlotProps extends object> {
  proxy: TSlotProps & SlotPropsBase
}

/**
 * Proxy that turns property access into ClientSlot renders.
 * Also tracks accessed slot names for devtools.
 */
function createSlotProxy<TSlotProps extends object>(options?: {
  onSlotCall?: (name: string, args: Array<any>) => void
}): SlotProxyResult<TSlotProps> {
  const cache = new Map<string, (...args: Array<any>) => React.ReactNode>()

  const proxy = new Proxy({} as TSlotProps & SlotPropsBase, {
    get(_target, prop) {
      if (prop === 'then' || typeof prop !== 'string') return undefined

      if (prop === 'children') {
        options?.onSlotCall?.('children', [])
        return createElement(ClientSlot, { slot: 'children', args: [] })
      }

      let fn = cache.get(prop)
      if (!fn) {
        fn = (...args: Array<any>) => {
          options?.onSlotCall?.(prop, args)
          return createElement(ClientSlot, { slot: prop, args })
        }
        cache.set(prop, fn)
      }
      return fn
    },
  })

  return {
    proxy,
  }
}

function createReadableStreamEmitter<T>(): {
  stream: ReadableStream<T>
  emit: (value: T) => void
  close: () => void
} {
  let closed = false
  const queue: Array<T> = []
  let controller: ReadableStreamDefaultController<T> | null = null

  const stream = new ReadableStream<T>({
    start(ctrl) {
      controller = ctrl
      for (const value of queue) {
        try {
          ctrl.enqueue(value)
        } catch {
          // Ignore
        }
      }
      queue.length = 0
      if (closed) {
        try {
          ctrl.close()
        } catch {
          // Ignore
        }
      }
    },
    cancel() {
      closed = true
      controller = null
      queue.length = 0
    },
  })

  const emit = (value: T) => {
    if (closed) return
    if (!controller) {
      queue.push(value)
      return
    }
    try {
      controller.enqueue(value)
    } catch {
      // Ignore
    }
  }

  const close = () => {
    if (closed) return
    closed = true
    if (controller) {
      try {
        controller.close()
      } catch {
        // Ignore
      }
      controller = null
    }
  }

  return { stream, emit, close }
}

function wrapReadableStream<T>(
  source: ReadableStream<T>,
  handlers: {
    onDone?: () => void
    onCancel?: () => void
    onError?: () => void
  },
): ReadableStream<T> {
  const reader = source.getReader()
  let finished = false

  const finish = () => {
    if (finished) return
    finished = true
    handlers.onDone?.()
    try {
      reader.releaseLock()
    } catch {
      // Ignore
    }
  }

  return new ReadableStream<T>({
    async pull(controller) {
      try {
        const { value, done } = await reader.read()
        if (done) {
          controller.close()
          finish()
          return
        }
        controller.enqueue(value)
      } catch (err) {
        try {
          controller.error(err)
        } catch {
          // Ignore
        }
        handlers.onError?.()
        finish()
      }
    },
    async cancel(reason) {
      handlers.onCancel?.()
      try {
        await reader.cancel(reason)
      } catch {
        // Ignore
      }
      finish()
    },
  })
}
