/**
 * Binary frame protocol for multiplexing JSON and raw streams over HTTP.
 *
 * Frame format: [type:1][streamId:4][length:4][payload:length]
 * - type: 1 byte - frame type (JSON, CHUNK, END, ERROR)
 * - streamId: 4 bytes big-endian uint32 - stream identifier
 * - length: 4 bytes big-endian uint32 - payload length
 * - payload: variable length bytes
 */

// Re-export constants from shared location
import { FRAME_HEADER_SIZE, FrameType } from '@tanstack/start-client-core'

export {
  FRAME_HEADER_SIZE,
  FrameType,
  TSS_CONTENT_TYPE_FRAMED,
  TSS_CONTENT_TYPE_FRAMED_VERSIONED,
  TSS_FRAMED_PROTOCOL_VERSION,
} from '@tanstack/start-client-core'

/** Cached TextEncoder for frame encoding */
const textEncoder = new TextEncoder()

/** Shared empty payload for END frames - avoids allocation per call */
const EMPTY_PAYLOAD = new Uint8Array(0)

/**
 * Encodes a single frame with header and payload.
 */
export function encodeFrame(
  type: FrameType,
  streamId: number,
  payload: Uint8Array,
): Uint8Array {
  const frame = new Uint8Array(FRAME_HEADER_SIZE + payload.length)
  // Write header bytes directly to avoid DataView allocation per frame
  // Frame format: [type:1][streamId:4 BE][length:4 BE]
  frame[0] = type
  frame[1] = (streamId >>> 24) & 0xff
  frame[2] = (streamId >>> 16) & 0xff
  frame[3] = (streamId >>> 8) & 0xff
  frame[4] = streamId & 0xff
  frame[5] = (payload.length >>> 24) & 0xff
  frame[6] = (payload.length >>> 16) & 0xff
  frame[7] = (payload.length >>> 8) & 0xff
  frame[8] = payload.length & 0xff
  frame.set(payload, FRAME_HEADER_SIZE)
  return frame
}

/**
 * Encodes a JSON frame (type 0, streamId 0).
 */
export function encodeJSONFrame(json: string): Uint8Array {
  return encodeFrame(FrameType.JSON, 0, textEncoder.encode(json))
}

/**
 * Encodes a raw stream chunk frame.
 */
export function encodeChunkFrame(
  streamId: number,
  chunk: Uint8Array,
): Uint8Array {
  return encodeFrame(FrameType.CHUNK, streamId, chunk)
}

/**
 * Encodes a raw stream end frame.
 */
export function encodeEndFrame(streamId: number): Uint8Array {
  return encodeFrame(FrameType.END, streamId, EMPTY_PAYLOAD)
}

/**
 * Encodes a raw stream error frame.
 */
export function encodeErrorFrame(streamId: number, error: unknown): Uint8Array {
  const message =
    error instanceof Error ? error.message : String(error ?? 'Unknown error')
  return encodeFrame(FrameType.ERROR, streamId, textEncoder.encode(message))
}

/**
 * Late stream registration for RawStreams discovered after serialization starts.
 * Used when Promise<RawStream> resolves after the initial synchronous pass.
 */
export interface LateStreamRegistration {
  id: number
  stream: ReadableStream<Uint8Array>
}

/**
 * Creates a multiplexed ReadableStream from JSON stream and raw streams.
 *
 * The JSON stream emits NDJSON lines (from seroval's toCrossJSONStream).
 * Raw streams are pumped concurrently, interleaved with JSON frames.
 *
 * Supports late stream registration for RawStreams discovered after initial
 * serialization (e.g., from resolved Promises).
 *
 * @param jsonStream Stream of JSON strings (each string is one NDJSON line)
 * @param rawStreams Map of stream IDs to raw binary streams (known at start)
 * @param lateStreamSource Optional stream of late registrations for streams discovered later
 */
export function createMultiplexedStream(
  jsonStream: ReadableStream<string>,
  rawStreams: Map<number, ReadableStream<Uint8Array>>,
  lateStreamSource?: ReadableStream<LateStreamRegistration>,
): ReadableStream<Uint8Array> {
  // Shared state for the multiplexed stream
  let controller: ReadableStreamDefaultController<Uint8Array>
  let cancelled = false
  const readers: Array<ReadableStreamDefaultReader<any>> = []

  // Helper to enqueue a frame, ignoring errors if stream is closed/cancelled
  const enqueue = (frame: Uint8Array): boolean => {
    if (cancelled) return false
    try {
      controller.enqueue(frame)
      return true
    } catch {
      return false
    }
  }

  // Helper to error the output stream (for fatal errors like JSON stream failure)
  const errorOutput = (error: unknown): void => {
    if (cancelled) return
    cancelled = true
    try {
      controller.error(error)
    } catch {
      // Already errored
    }
    // Cancel all readers to stop other pumps
    for (const reader of readers) {
      reader.cancel().catch(() => {})
    }
  }

  // Pumps a raw stream, sending CHUNK frames and END/ERROR on completion
  async function pumpRawStream(
    streamId: number,
    stream: ReadableStream<Uint8Array>,
  ): Promise<void> {
    const reader = stream.getReader()
    readers.push(reader)
    try {
      while (!cancelled) {
        const { done, value } = await reader.read()
        if (done) {
          enqueue(encodeEndFrame(streamId))
          return
        }
        if (!enqueue(encodeChunkFrame(streamId, value))) return
      }
    } catch (error) {
      // Raw stream error - send ERROR frame, don't fail entire response
      enqueue(encodeErrorFrame(streamId, error))
    } finally {
      reader.releaseLock()
    }
  }

  // Pumps the JSON stream, sending JSON frames
  // JSON stream errors are fatal - they error the entire output
  async function pumpJSON(): Promise<void> {
    const reader = jsonStream.getReader()
    readers.push(reader)
    try {
      while (!cancelled) {
        const { done, value } = await reader.read()
        if (done) return
        if (!enqueue(encodeJSONFrame(value))) return
      }
    } catch (error) {
      // JSON stream error is fatal - error the entire output
      errorOutput(error)
      throw error // Re-throw to signal failure to Promise.all
    } finally {
      reader.releaseLock()
    }
  }

  // Pumps late stream registrations, spawning raw stream pumps as they arrive
  async function pumpLateStreams(): Promise<Array<Promise<void>>> {
    if (!lateStreamSource) return []

    const lateStreamPumps: Array<Promise<void>> = []
    const reader = lateStreamSource.getReader()
    readers.push(reader)
    try {
      while (!cancelled) {
        const { done, value } = await reader.read()
        if (done) break
        // Start pumping this late stream and track it
        lateStreamPumps.push(pumpRawStream(value.id, value.stream))
      }
    } finally {
      reader.releaseLock()
    }
    return lateStreamPumps
  }

  return new ReadableStream<Uint8Array>({
    async start(ctrl) {
      controller = ctrl

      // Collect all pump promises
      const pumps: Array<Promise<void | Array<Promise<void>>>> = [pumpJSON()]

      for (const [streamId, stream] of rawStreams) {
        pumps.push(pumpRawStream(streamId, stream))
      }

      // Add late stream pump (returns array of spawned pump promises)
      if (lateStreamSource) {
        pumps.push(pumpLateStreams())
      }

      try {
        // Wait for initial pumps to complete
        const results = await Promise.all(pumps)

        // Wait for any late stream pumps that were spawned
        const latePumps = results.find(Array.isArray) as
          | Array<Promise<void>>
          | undefined
        if (latePumps && latePumps.length > 0) {
          await Promise.all(latePumps)
        }

        // All pumps done - close the output stream
        if (!cancelled) {
          try {
            controller.close()
          } catch {
            // Already closed
          }
        }
      } catch {
        // Error already handled by errorOutput in pumpJSON
        // or was a raw stream error (non-fatal, already sent ERROR frame)
      }
    },

    cancel() {
      cancelled = true
      // Cancel all readers to stop pumps quickly
      for (const reader of readers) {
        reader.cancel().catch(() => {})
      }
      readers.length = 0
    },
  })
}
