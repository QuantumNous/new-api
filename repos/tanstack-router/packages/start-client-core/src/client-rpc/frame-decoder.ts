/**
 * Client-side frame decoder for multiplexed responses.
 *
 * Decodes binary frame protocol and reconstructs:
 * - JSON stream (NDJSON lines for seroval)
 * - Raw streams (binary data as ReadableStream<Uint8Array>)
 */

import { FRAME_HEADER_SIZE, FrameType } from '../constants'

/** Cached TextDecoder for frame decoding */
const textDecoder = new TextDecoder()

/** Shared empty buffer for empty buffer case - avoids allocation */
const EMPTY_BUFFER = new Uint8Array(0)

/** Hardening limits to prevent memory/CPU DoS */
const MAX_FRAME_PAYLOAD_SIZE = 16 * 1024 * 1024 // 16MiB
const MAX_BUFFERED_BYTES = 32 * 1024 * 1024 // 32MiB
const MAX_STREAMS = 1024
const MAX_FRAMES = 100_000 // Limit total frames to prevent CPU DoS

/**
 * Result of frame decoding.
 */
export interface FrameDecoderResult {
  /** Gets or creates a raw stream by ID (for use by deserialize plugin) */
  getOrCreateStream: (id: number) => ReadableStream<Uint8Array>
  /** Stream of JSON strings (NDJSON lines) */
  jsonChunks: ReadableStream<string>
}

/**
 * Creates a frame decoder that processes a multiplexed response stream.
 *
 * @param input The raw response body stream
 * @returns Decoded JSON stream and stream getter function
 */
export function createFrameDecoder(
  input: ReadableStream<Uint8Array>,
): FrameDecoderResult {
  const streamControllers = new Map<
    number,
    ReadableStreamDefaultController<Uint8Array>
  >()
  const streams = new Map<number, ReadableStream<Uint8Array>>()
  const cancelledStreamIds = new Set<number>()

  let cancelled = false as boolean
  let inputReader: ReadableStreamReader<Uint8Array> | null = null
  let frameCount = 0

  let jsonController!: ReadableStreamDefaultController<string>
  const jsonChunks = new ReadableStream<string>({
    start(controller) {
      jsonController = controller
    },
    cancel() {
      cancelled = true
      try {
        inputReader?.cancel()
      } catch {
        // Ignore
      }

      streamControllers.forEach((ctrl) => {
        try {
          ctrl.error(new Error('Framed response cancelled'))
        } catch {
          // Ignore
        }
      })
      streamControllers.clear()
      streams.clear()
      cancelledStreamIds.clear()
    },
  })

  /**
   * Gets or creates a stream for a given stream ID.
   * Called by deserialize plugin when it encounters a RawStream reference.
   */
  function getOrCreateStream(id: number): ReadableStream<Uint8Array> {
    const existing = streams.get(id)
    if (existing) {
      return existing
    }

    // If we already received an END/ERROR for this streamId, returning a fresh stream
    // would hang consumers. Return an already-closed stream instead.
    if (cancelledStreamIds.has(id)) {
      return new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close()
        },
      })
    }

    if (streams.size >= MAX_STREAMS) {
      throw new Error(
        `Too many raw streams in framed response (max ${MAX_STREAMS})`,
      )
    }

    const stream = new ReadableStream<Uint8Array>({
      start(ctrl) {
        streamControllers.set(id, ctrl)
      },
      cancel() {
        cancelledStreamIds.add(id)
        streamControllers.delete(id)
        streams.delete(id)
      },
    })
    streams.set(id, stream)
    return stream
  }

  /**
   * Ensures stream exists and returns its controller for enqueuing data.
   * Used for CHUNK frames where we need to ensure stream is created.
   */
  function ensureController(
    id: number,
  ): ReadableStreamDefaultController<Uint8Array> | undefined {
    getOrCreateStream(id)
    return streamControllers.get(id)
  }

  // Process frames asynchronously
  ;(async () => {
    const reader = input.getReader()
    inputReader = reader

    const bufferList: Array<Uint8Array> = []
    let totalLength = 0

    /**
     * Reads header bytes from buffer chunks without flattening.
     * Returns header data or null if not enough bytes available.
     */
    function readHeader(): {
      type: number
      streamId: number
      length: number
    } | null {
      if (totalLength < FRAME_HEADER_SIZE) return null

      const first = bufferList[0]!

      // Fast path: header fits entirely in first chunk (common case)
      if (first.length >= FRAME_HEADER_SIZE) {
        const type = first[0]!
        const streamId =
          ((first[1]! << 24) |
            (first[2]! << 16) |
            (first[3]! << 8) |
            first[4]!) >>>
          0
        const length =
          ((first[5]! << 24) |
            (first[6]! << 16) |
            (first[7]! << 8) |
            first[8]!) >>>
          0
        return { type, streamId, length }
      }

      // Slow path: header spans multiple chunks - flatten header bytes only
      const headerBytes = new Uint8Array(FRAME_HEADER_SIZE)
      let offset = 0
      let remaining = FRAME_HEADER_SIZE
      for (let i = 0; i < bufferList.length && remaining > 0; i++) {
        const chunk = bufferList[i]!
        const toCopy = Math.min(chunk.length, remaining)
        headerBytes.set(chunk.subarray(0, toCopy), offset)
        offset += toCopy
        remaining -= toCopy
      }

      const type = headerBytes[0]!
      const streamId =
        ((headerBytes[1]! << 24) |
          (headerBytes[2]! << 16) |
          (headerBytes[3]! << 8) |
          headerBytes[4]!) >>>
        0
      const length =
        ((headerBytes[5]! << 24) |
          (headerBytes[6]! << 16) |
          (headerBytes[7]! << 8) |
          headerBytes[8]!) >>>
        0

      return { type, streamId, length }
    }

    /**
     * Flattens buffer list into single Uint8Array and removes from list.
     */
    function extractFlattened(count: number): Uint8Array {
      if (count === 0) return EMPTY_BUFFER

      // Fast path: the requested bytes are fully contained in the first buffered
      // chunk (the common case — most frames arrive within a single network
      // read). Return a subarray view instead of allocating a new buffer and
      // copying `count` bytes. The view shares the chunk's backing ArrayBuffer,
      // which is safe because buffered chunks are never mutated in place after
      // being read from the network.
      const first = bufferList[0]
      if (first && first.length >= count) {
        const result = first.subarray(0, count)
        if (first.length === count) {
          bufferList.shift()
        } else {
          bufferList[0] = first.subarray(count)
        }
        totalLength -= count
        return result
      }

      // Slow path: the requested bytes span multiple chunks — flatten by copying.
      const result = new Uint8Array(count)
      let offset = 0
      let remaining = count

      while (remaining > 0 && bufferList.length > 0) {
        const chunk = bufferList[0]
        if (!chunk) break
        const toCopy = Math.min(chunk.length, remaining)
        result.set(chunk.subarray(0, toCopy), offset)

        offset += toCopy
        remaining -= toCopy

        if (toCopy === chunk.length) {
          bufferList.shift()
        } else {
          bufferList[0] = chunk.subarray(toCopy)
        }
      }

      totalLength -= count
      return result
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (true) {
        const { done, value } = await reader.read()
        if (cancelled) break
        if (done) break

        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!value) continue

        // Append incoming chunk to buffer list
        if (totalLength + value.length > MAX_BUFFERED_BYTES) {
          throw new Error(
            `Framed response buffer exceeded ${MAX_BUFFERED_BYTES} bytes`,
          )
        }
        bufferList.push(value)
        totalLength += value.length

        // Parse complete frames from buffer
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
          const header = readHeader()
          if (!header) break // Not enough bytes for header

          const { type, streamId, length } = header

          if (
            type !== FrameType.JSON &&
            type !== FrameType.CHUNK &&
            type !== FrameType.END &&
            type !== FrameType.ERROR
          ) {
            throw new Error(`Unknown frame type: ${type}`)
          }

          // Enforce stream id conventions: JSON uses streamId 0, raw streams use non-zero ids
          if (type === FrameType.JSON) {
            if (streamId !== 0) {
              throw new Error('Invalid JSON frame streamId (expected 0)')
            }
          } else {
            if (streamId === 0) {
              throw new Error('Invalid raw frame streamId (expected non-zero)')
            }
          }

          if (length > MAX_FRAME_PAYLOAD_SIZE) {
            throw new Error(
              `Frame payload too large: ${length} bytes (max ${MAX_FRAME_PAYLOAD_SIZE})`,
            )
          }

          const frameSize = FRAME_HEADER_SIZE + length
          if (totalLength < frameSize) break // Wait for more data

          if (++frameCount > MAX_FRAMES) {
            throw new Error(
              `Too many frames in framed response (max ${MAX_FRAMES})`,
            )
          }

          // Extract and consume header bytes
          extractFlattened(FRAME_HEADER_SIZE)

          // Extract payload
          const payload = extractFlattened(length)

          // Process frame by type
          switch (type) {
            case FrameType.JSON: {
              try {
                jsonController.enqueue(textDecoder.decode(payload))
              } catch {
                // JSON stream may be cancelled/closed
              }
              break
            }

            case FrameType.CHUNK: {
              const ctrl = ensureController(streamId)
              if (ctrl) {
                ctrl.enqueue(payload)
              }
              break
            }

            case FrameType.END: {
              const ctrl = ensureController(streamId)
              cancelledStreamIds.add(streamId)
              if (ctrl) {
                try {
                  ctrl.close()
                } catch {
                  // Already closed
                }
                streamControllers.delete(streamId)
              }
              break
            }

            case FrameType.ERROR: {
              const ctrl = ensureController(streamId)
              cancelledStreamIds.add(streamId)
              if (ctrl) {
                const message = textDecoder.decode(payload)
                ctrl.error(new Error(message))
                streamControllers.delete(streamId)
              }
              break
            }
          }
        }
      }

      if (totalLength !== 0) {
        throw new Error('Incomplete frame at end of framed response')
      }

      // Close JSON stream when done
      try {
        jsonController.close()
      } catch {
        // JSON stream may be cancelled/closed
      }

      // Close any remaining streams (shouldn't happen in normal operation)
      streamControllers.forEach((ctrl) => {
        try {
          ctrl.close()
        } catch {
          // Already closed
        }
      })
      streamControllers.clear()
    } catch (error) {
      // Error reading - propagate to all streams
      try {
        jsonController.error(error)
      } catch {
        // Already errored/closed
      }
      streamControllers.forEach((ctrl) => {
        try {
          ctrl.error(error)
        } catch {
          // Already errored/closed
        }
      })
      streamControllers.clear()
    } finally {
      try {
        reader.releaseLock()
      } catch {
        // Ignore
      }
      inputReader = null
    }
  })()

  return { getOrCreateStream, jsonChunks }
}
