import { createPlugin, createStream } from 'seroval'
import type { PluginData, PluginInfo, SerovalNode } from 'seroval'

/**
 * Hint for RawStream encoding strategy during SSR serialization.
 * - 'binary': Always use base64 encoding (best for binary data like files, images)
 * - 'text': Try UTF-8 first, fallback to base64 (best for text-heavy data like RSC payloads)
 */
export type RawStreamHint = 'binary' | 'text'

/**
 * Options for RawStream configuration.
 */
export interface RawStreamOptions {
  /**
   * Encoding hint for SSR serialization.
   * - 'binary' (default): Always use base64 encoding
   * - 'text': Try UTF-8 first, fallback to base64 for invalid UTF-8 chunks
   */
  hint?: RawStreamHint
}

/**
 * Marker class for ReadableStream<Uint8Array> that should be serialized
 * with base64 encoding (SSR) or binary framing (server functions).
 *
 * Wrap your binary streams with this to get efficient serialization:
 * ```ts
 * // For binary data (files, images, etc.)
 * return { data: new RawStream(file.stream()) }
 *
 * // For text-heavy data (RSC payloads, etc.)
 * return { data: new RawStream(rscStream, { hint: 'text' }) }
 * ```
 */
export class RawStream {
  public readonly hint: RawStreamHint

  constructor(
    public readonly stream: ReadableStream<Uint8Array>,
    options?: RawStreamOptions,
  ) {
    this.hint = options?.hint ?? 'binary'
  }
}

/**
 * Callback type for RPC plugin to register raw streams with multiplexer
 */
export type OnRawStreamCallback = (
  streamId: number,
  stream: ReadableStream<Uint8Array>,
) => void

// Base64 helpers used in both Node and browser.
// In Node-like runtimes, prefer Buffer for speed and compatibility.
const BufferCtor: any = (globalThis as any).Buffer
const hasNodeBuffer = !!BufferCtor && typeof BufferCtor.from === 'function'

function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (bytes.length === 0) return ''

  if (hasNodeBuffer) {
    return BufferCtor.from(bytes).toString('base64')
  }

  // Browser fallback: chunked String.fromCharCode + btoa
  const CHUNK_SIZE = 0x8000 // 32KB chunks to avoid stack overflow
  const chunks: Array<string> = []
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE)
    chunks.push(String.fromCharCode.apply(null, chunk as any))
  }
  return btoa(chunks.join(''))
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (base64.length === 0) return new Uint8Array(0)

  if (hasNodeBuffer) {
    const buf = BufferCtor.from(base64, 'base64')
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  }

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

// Factory sentinels - use null-proto objects to avoid prototype surprises
const RAW_STREAM_FACTORY_BINARY: Record<string, never> = Object.create(null)
const RAW_STREAM_FACTORY_TEXT: Record<string, never> = Object.create(null)

// Factory constructor for binary mode - converts seroval stream to ReadableStream<Uint8Array>
// All chunks are base64 encoded strings
const RAW_STREAM_FACTORY_CONSTRUCTOR_BINARY = (
  stream: ReturnType<typeof createStream>,
) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on({
        next(base64: string) {
          try {
            controller.enqueue(base64ToUint8Array(base64))
          } catch {
            // Stream may be closed
          }
        },
        throw(error: unknown) {
          controller.error(error)
        },
        return() {
          try {
            controller.close()
          } catch {
            // Stream may already be closed
          }
        },
      })
    },
  })

// Factory constructor for text mode - converts seroval stream to ReadableStream<Uint8Array>
// Chunks are either strings (UTF-8) or { $b64: string } (base64 fallback)
// Use module-level TextEncoder to avoid per-factory allocation
const textEncoderForFactory = new TextEncoder()
const RAW_STREAM_FACTORY_CONSTRUCTOR_TEXT = (
  stream: ReturnType<typeof createStream>,
) => {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on({
        next(value: string | { $b64: string }) {
          try {
            if (typeof value === 'string') {
              controller.enqueue(textEncoderForFactory.encode(value))
            } else {
              controller.enqueue(base64ToUint8Array(value.$b64))
            }
          } catch {
            // Stream may be closed
          }
        },
        throw(error: unknown) {
          controller.error(error)
        },
        return() {
          try {
            controller.close()
          } catch {
            // Stream may already be closed
          }
        },
      })
    },
  })
}

// Minified factory function for binary mode - all chunks are base64 strings
// This must be self-contained since it's injected into the HTML
const FACTORY_BINARY = `(s=>new ReadableStream({start(c){s.on({next(b){try{const d=atob(b),a=new Uint8Array(d.length);for(let i=0;i<d.length;i++)a[i]=d.charCodeAt(i);c.enqueue(a)}catch(_){}},throw(e){c.error(e)},return(){try{c.close()}catch(_){}}})}}))`

// Minified factory function for text mode - chunks are string or {$b64: string}
// Uses cached TextEncoder for performance
const FACTORY_TEXT = `(s=>{const e=new TextEncoder();return new ReadableStream({start(c){s.on({next(v){try{if(typeof v==='string'){c.enqueue(e.encode(v))}else{const d=atob(v.$b64),a=new Uint8Array(d.length);for(let i=0;i<d.length;i++)a[i]=d.charCodeAt(i);c.enqueue(a)}}catch(_){}},throw(x){c.error(x)},return(){try{c.close()}catch(_){}}})}})})`

// Convert ReadableStream<Uint8Array> to seroval stream with base64-encoded chunks (binary mode)
function toBinaryStream(readable: ReadableStream<Uint8Array>) {
  const stream = createStream()
  const reader = readable.getReader()

  // Use iterative loop instead of recursive async to avoid stack accumulation
  ;(async () => {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          stream.return(undefined)
          break
        }
        stream.next(uint8ArrayToBase64(value))
      }
    } catch (error) {
      stream.throw(error)
    } finally {
      reader.releaseLock()
    }
  })()

  return stream
}

// Convert ReadableStream<Uint8Array> to seroval stream with UTF-8 first, base64 fallback (text mode)
function toTextStream(readable: ReadableStream<Uint8Array>) {
  const stream = createStream()
  const reader = readable.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })

  // Use iterative loop instead of recursive async to avoid stack accumulation
  ;(async () => {
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // Flush any remaining bytes in the decoder
          try {
            const remaining = decoder.decode()
            if (remaining.length > 0) {
              stream.next(remaining)
            }
          } catch {
            // Ignore decode errors on flush
          }
          stream.return(undefined)
          break
        }

        try {
          // Try UTF-8 decode first
          const text = decoder.decode(value, { stream: true })
          if (text.length > 0) {
            stream.next(text)
          }
        } catch {
          // UTF-8 decode failed, fallback to base64
          stream.next({ $b64: uint8ArrayToBase64(value) })
        }
      }
    } catch (error) {
      stream.throw(error)
    } finally {
      reader.releaseLock()
    }
  })()

  return stream
}

// Factory plugin for binary mode
const RawStreamFactoryBinaryPlugin = /* @__PURE__ */ createPlugin<
  Record<string, never>,
  PluginInfo
>({
  tag: 'tss/RawStreamFactory',
  test(value) {
    return value === RAW_STREAM_FACTORY_BINARY
  },
  parse: {
    sync(_value, _ctx, _data) {
      return {}
    },
    async async(_value, _ctx, _data) {
      return {}
    },
    stream(_value, _ctx, _data) {
      return {}
    },
  },
  serialize(_node, _ctx, _data) {
    return FACTORY_BINARY
  },
  deserialize(_node, _ctx, _data) {
    return RAW_STREAM_FACTORY_BINARY
  },
})

// Factory plugin for text mode
const RawStreamFactoryTextPlugin = /* @__PURE__ */ createPlugin<
  Record<string, never>,
  PluginInfo
>({
  tag: 'tss/RawStreamFactoryText',
  test(value) {
    return value === RAW_STREAM_FACTORY_TEXT
  },
  parse: {
    sync(_value, _ctx, _data) {
      return {}
    },
    async async(_value, _ctx, _data) {
      return {}
    },
    stream(_value, _ctx, _data) {
      return {}
    },
  },
  serialize(_node, _ctx, _data) {
    return FACTORY_TEXT
  },
  deserialize(_node, _ctx, _data) {
    return RAW_STREAM_FACTORY_TEXT
  },
})

export interface RawStreamSSRNode extends PluginInfo {
  hint: SerovalNode
  factory: SerovalNode
  stream: SerovalNode
}

export interface RawStreamRPCNode extends PluginInfo {
  streamId: SerovalNode
}

/**
 * SSR Plugin - uses base64 or UTF-8+base64 encoding for chunks, delegates to seroval's stream mechanism.
 * Used during SSR when serializing to JavaScript code for HTML injection.
 *
 * Supports two modes based on RawStream hint:
 * - 'binary': Always base64 encode (default)
 * - 'text': Try UTF-8 first, fallback to base64 for invalid UTF-8
 */
export const RawStreamSSRPlugin = /* @__PURE__ */ createPlugin<
  RawStream,
  RawStreamSSRNode
>({
  tag: 'tss/RawStream',
  extends: [RawStreamFactoryBinaryPlugin, RawStreamFactoryTextPlugin],

  test(value: unknown) {
    return value instanceof RawStream
  },

  parse: {
    sync(value: RawStream, ctx, _data) {
      // Sync parse not really supported for streams, return empty stream
      const factory =
        value.hint === 'text'
          ? RAW_STREAM_FACTORY_TEXT
          : RAW_STREAM_FACTORY_BINARY
      return {
        hint: ctx.parse(value.hint),
        factory: ctx.parse(factory),
        stream: ctx.parse(createStream()),
      }
    },
    async async(value: RawStream, ctx, _data) {
      const factory =
        value.hint === 'text'
          ? RAW_STREAM_FACTORY_TEXT
          : RAW_STREAM_FACTORY_BINARY
      const encodedStream =
        value.hint === 'text'
          ? toTextStream(value.stream)
          : toBinaryStream(value.stream)
      return {
        hint: await ctx.parse(value.hint),
        factory: await ctx.parse(factory),
        stream: await ctx.parse(encodedStream),
      }
    },
    stream(value: RawStream, ctx, _data) {
      const factory =
        value.hint === 'text'
          ? RAW_STREAM_FACTORY_TEXT
          : RAW_STREAM_FACTORY_BINARY
      const encodedStream =
        value.hint === 'text'
          ? toTextStream(value.stream)
          : toBinaryStream(value.stream)
      return {
        hint: ctx.parse(value.hint),
        factory: ctx.parse(factory),
        stream: ctx.parse(encodedStream),
      }
    },
  },

  serialize(node: RawStreamSSRNode, ctx, _data) {
    return (
      '(' +
      ctx.serialize(node.factory) +
      ')(' +
      ctx.serialize(node.stream) +
      ')'
    )
  },

  deserialize(node: RawStreamSSRNode, ctx, _data): any {
    const stream: ReturnType<typeof createStream> = ctx.deserialize(node.stream)
    const hint = ctx.deserialize(node.hint)
    return hint === 'text'
      ? RAW_STREAM_FACTORY_CONSTRUCTOR_TEXT(stream)
      : RAW_STREAM_FACTORY_CONSTRUCTOR_BINARY(stream)
  },
})

/**
 * Creates an RPC plugin instance that registers raw streams with a multiplexer.
 * Used for server function responses where we want binary framing.
 * Note: RPC always uses binary framing regardless of hint.
 *
 * @param onRawStream Callback invoked when a RawStream is encountered during serialization
 */
/* @__NO_SIDE_EFFECTS__ */
export function createRawStreamRPCPlugin(onRawStream: OnRawStreamCallback) {
  // Own stream counter - sequential IDs starting at 1, independent of seroval internals
  let nextStreamId = 1

  return /* @__PURE__ */ createPlugin<RawStream, RawStreamRPCNode>({
    tag: 'tss/RawStream',

    test(value: unknown) {
      return value instanceof RawStream
    },

    parse: {
      async async(value: RawStream, ctx, _data: PluginData) {
        const streamId = nextStreamId++
        onRawStream(streamId, value.stream)
        return { streamId: await ctx.parse(streamId) }
      },
      stream(value: RawStream, ctx, _data: PluginData) {
        const streamId = nextStreamId++
        onRawStream(streamId, value.stream)
        return { streamId: ctx.parse(streamId) }
      },
    },

    serialize(): never {
      // RPC uses toCrossJSONStream which produces JSON nodes, not JS code.
      // This method is only called by crossSerialize* which we don't use.
      throw new Error(
        'RawStreamRPCPlugin.serialize should not be called. RPC uses JSON serialization, not JS code generation.',
      )
    },

    deserialize(): never {
      // Client uses createRawStreamDeserializePlugin instead
      throw new Error(
        'RawStreamRPCPlugin.deserialize should not be called. Use createRawStreamDeserializePlugin on client.',
      )
    },
  })
}

/**
 * Creates a deserialize-only plugin for client-side stream reconstruction.
 * Used in serverFnFetcher to wire up streams from frame decoder.
 *
 * @param getOrCreateStream Function to get/create a stream by ID from frame decoder
 */
export function createRawStreamDeserializePlugin(
  getOrCreateStream: (id: number) => ReadableStream<Uint8Array>,
) {
  return /* @__PURE__ */ createPlugin<any, RawStreamRPCNode>({
    tag: 'tss/RawStream',

    test: () => false, // Client never serializes RawStream

    parse: {}, // Client only deserializes, never parses

    serialize(): never {
      // Client never serializes RawStream back to server
      throw new Error(
        'RawStreamDeserializePlugin.serialize should not be called. Client only deserializes.',
      )
    },

    deserialize(node, ctx, _data) {
      // In normal seroval usage, ctx.deserialize exists.
      // Some unit tests call plugin.deserialize directly with a minimal ctx.
      const id =
        typeof (ctx as any)?.deserialize === 'function'
          ? (ctx as any).deserialize(node.streamId)
          : (node as any).streamId
      return getOrCreateStream(id as number)
    },
  })
}
