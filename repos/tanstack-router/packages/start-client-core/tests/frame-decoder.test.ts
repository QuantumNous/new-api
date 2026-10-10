import { describe, expect, it } from 'vitest'
import { createFrameDecoder } from '../src/client-rpc/frame-decoder'
import { FRAME_HEADER_SIZE, FrameType } from '../src/constants'

/**
 * Helper to encode a frame for testing
 */
function encodeFrame(
  type: number,
  streamId: number,
  payload: Uint8Array,
): Uint8Array {
  const frame = new Uint8Array(FRAME_HEADER_SIZE + payload.length)
  const view = new DataView(frame.buffer)
  view.setUint8(0, type)
  view.setUint32(1, streamId, false)
  view.setUint32(5, payload.length, false)
  frame.set(payload, FRAME_HEADER_SIZE)
  return frame
}

function encodeJSONFrame(json: string): Uint8Array {
  return encodeFrame(FrameType.JSON, 0, new TextEncoder().encode(json))
}

function encodeChunkFrame(streamId: number, data: Uint8Array): Uint8Array {
  return encodeFrame(FrameType.CHUNK, streamId, data)
}

function encodeEndFrame(streamId: number): Uint8Array {
  return encodeFrame(FrameType.END, streamId, new Uint8Array(0))
}

function encodeErrorFrame(streamId: number, message: string): Uint8Array {
  return encodeFrame(
    FrameType.ERROR,
    streamId,
    new TextEncoder().encode(message),
  )
}

describe('frame-decoder', () => {
  describe('createFrameDecoder', () => {
    it('should reject unknown frame type', async () => {
      const badFrame = encodeFrame(99, 0, new Uint8Array(0))
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(badFrame)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()

      await expect(reader.read()).rejects.toThrow('Unknown frame type')
    })

    it('should reject raw frames with streamId 0', async () => {
      const badChunk = encodeFrame(FrameType.CHUNK, 0, new Uint8Array([1]))
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(badChunk)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()

      await expect(reader.read()).rejects.toThrow('Invalid raw frame streamId')
    })

    it('should reject JSON frames with non-zero streamId', async () => {
      const badJson = encodeFrame(
        FrameType.JSON,
        1,
        new TextEncoder().encode('{}\n'),
      )
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(badJson)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()

      await expect(reader.read()).rejects.toThrow('Invalid JSON frame streamId')
    })

    it('should reject oversized frame payloads', async () => {
      // Declare a payload length > MAX_FRAME_PAYLOAD_SIZE with no payload.
      const headerOnly = new Uint8Array(FRAME_HEADER_SIZE)
      const view = new DataView(headerOnly.buffer)
      view.setUint8(0, FrameType.JSON)
      view.setUint32(1, 0, false)
      view.setUint32(5, 16 * 1024 * 1024 + 1, false)

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(headerOnly)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()

      await expect(reader.read()).rejects.toThrow('Frame payload too large')
    })

    it('should reject incomplete frames at end-of-stream', async () => {
      const headerOnly = new Uint8Array(FRAME_HEADER_SIZE)
      const view = new DataView(headerOnly.buffer)
      view.setUint8(0, FrameType.JSON)
      view.setUint32(1, 0, false)
      view.setUint32(5, 3, false)

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(headerOnly)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()

      await expect(reader.read()).rejects.toThrow('Incomplete frame')
    })

    it('should cancel input when jsonChunks cancelled', async () => {
      let cancelled = false
      const input = new ReadableStream<Uint8Array>({
        pull() {},
        cancel() {
          cancelled = true
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()

      await reader.cancel()
      expect(cancelled).toBe(true)
    })

    it('should reject too many raw streams', async () => {
      // END frames create streams via ensureController, even with no CHUNKs.
      const frames: Array<Uint8Array> = []
      for (let i = 1; i <= 1025; i++) {
        frames.push(encodeEndFrame(i))
      }

      const totalLen = frames.reduce((acc, f) => acc + f.length, 0)
      const combined = new Uint8Array(totalLen)
      let offset = 0
      for (const frame of frames) {
        combined.set(frame, offset)
        offset += frame.length
      }

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(combined)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()

      await expect(reader.read()).rejects.toThrow('Too many raw streams')
    })

    it('should reject when buffered bytes exceed limit', async () => {
      // No valid frame can be parsed from this; we just want to exceed MAX_BUFFERED_BYTES.
      const tooLarge = new Uint8Array(32 * 1024 * 1024 + 1)

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(tooLarge)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()

      await expect(reader.read()).rejects.toThrow('buffer exceeded')
    })

    it('should decode JSON frames', async () => {
      const frame1 = encodeJSONFrame('{"line":1}')
      const frame2 = encodeJSONFrame('{"line":2}')

      const combinedFrames = new Uint8Array(frame1.length + frame2.length)
      combinedFrames.set(frame1, 0)
      combinedFrames.set(frame2, frame1.length)

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(combinedFrames)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)

      const reader = jsonChunks.getReader()
      const chunks: Array<string> = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      expect(chunks).toEqual(['{"line":1}', '{"line":2}'])
    })

    it('should decode raw stream chunks', async () => {
      const jsonFrame = encodeJSONFrame('{}')
      const chunkFrame = encodeChunkFrame(5, new Uint8Array([1, 2, 3]))
      const endFrame = encodeEndFrame(5)

      const combined = new Uint8Array(
        jsonFrame.length + chunkFrame.length + endFrame.length,
      )
      combined.set(jsonFrame, 0)
      combined.set(chunkFrame, jsonFrame.length)
      combined.set(endFrame, jsonFrame.length + chunkFrame.length)

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(combined)
          controller.close()
        },
      })

      const { jsonChunks, getOrCreateStream } = createFrameDecoder(input)

      // Pre-create the stream before consuming
      const stream5 = getOrCreateStream(5)

      // Consume JSON first
      const jsonReader = jsonChunks.getReader()
      const { value: jsonValue } = await jsonReader.read()
      expect(jsonValue).toBe('{}')

      // Read the raw stream
      const rawReader = stream5.getReader()
      const { value: rawValue, done: rawDone } = await rawReader.read()

      expect(rawDone).toBe(false)
      expect(rawValue).toEqual(new Uint8Array([1, 2, 3]))

      const { done: finalDone } = await rawReader.read()
      expect(finalDone).toBe(true)
    })

    it('should handle partial frames across chunks', async () => {
      const frame = encodeJSONFrame('{"test":"data"}')

      // Split frame in the middle
      const part1 = frame.slice(0, 5)
      const part2 = frame.slice(5)

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(part1)
          controller.enqueue(part2)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)

      const reader = jsonChunks.getReader()
      const chunks: Array<string> = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      expect(chunks).toEqual(['{"test":"data"}'])
    })

    it('should use fast path when header fits in first chunk', async () => {
      // Single chunk contains entire frame - exercises fast path
      const frame = encodeJSONFrame('{"fast":"path"}')

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(frame)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()
      const { value } = await reader.read()

      expect(value).toBe('{"fast":"path"}')
    })

    it('should use slow path when header spans multiple chunks', async () => {
      // Split header itself across multiple chunks - exercises slow path
      const frame = encodeJSONFrame('{"slow":"path"}')

      // Split at byte 3, then byte 6, then rest - header is 9 bytes
      const part1 = frame.slice(0, 3) // first 3 bytes of header
      const part2 = frame.slice(3, 6) // next 3 bytes of header
      const part3 = frame.slice(6) // last 3 bytes of header + payload

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(part1)
          controller.enqueue(part2)
          controller.enqueue(part3)
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()
      const { value } = await reader.read()

      expect(value).toBe('{"slow":"path"}')
    })

    it('should handle header split at every byte boundary', async () => {
      // Extreme case: each header byte in separate chunk
      const frame = encodeJSONFrame('{"byte":"split"}')

      // Split into 9 single-byte chunks for header, then payload
      const chunks: Array<Uint8Array> = []
      for (let i = 0; i < FRAME_HEADER_SIZE; i++) {
        chunks.push(frame.slice(i, i + 1))
      }
      chunks.push(frame.slice(FRAME_HEADER_SIZE)) // payload

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) {
            controller.enqueue(chunk)
          }
          controller.close()
        },
      })

      const { jsonChunks } = createFrameDecoder(input)
      const reader = jsonChunks.getReader()
      const { value } = await reader.read()

      expect(value).toBe('{"byte":"split"}')
    })

    it('should handle multiple raw streams', async () => {
      const jsonFrame = encodeJSONFrame('{}')
      const chunk1 = encodeChunkFrame(1, new Uint8Array([10]))
      const chunk2 = encodeChunkFrame(2, new Uint8Array([20]))
      const end1 = encodeEndFrame(1)
      const end2 = encodeEndFrame(2)

      const totalLen =
        jsonFrame.length +
        chunk1.length +
        chunk2.length +
        end1.length +
        end2.length
      const combined = new Uint8Array(totalLen)
      let offset = 0
      for (const frame of [jsonFrame, chunk1, chunk2, end1, end2]) {
        combined.set(frame, offset)
        offset += frame.length
      }

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(combined)
          controller.close()
        },
      })

      const { getOrCreateStream, jsonChunks } = createFrameDecoder(input)

      // Pre-create streams before consuming
      const stream1 = getOrCreateStream(1)
      const stream2 = getOrCreateStream(2)

      // Drain JSON
      const jsonReader = jsonChunks.getReader()
      await jsonReader.read()

      // Read stream 1
      const reader1 = stream1.getReader()
      const { value: val1 } = await reader1.read()
      expect(val1).toEqual(new Uint8Array([10]))

      // Read stream 2
      const reader2 = stream2.getReader()
      const { value: val2 } = await reader2.read()
      expect(val2).toEqual(new Uint8Array([20]))
    })

    it('should handle error frames for existing streams', async () => {
      const jsonFrame = encodeJSONFrame('{}')
      // Create a stream, then error it immediately
      const chunkFrame = encodeChunkFrame(3, new Uint8Array([1]))
      const errorFrame = encodeErrorFrame(3, 'Stream failed')

      const combined = new Uint8Array(
        jsonFrame.length + chunkFrame.length + errorFrame.length,
      )
      combined.set(jsonFrame, 0)
      combined.set(chunkFrame, jsonFrame.length)
      combined.set(errorFrame, jsonFrame.length + chunkFrame.length)

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(combined)
          controller.close()
        },
      })

      const { getOrCreateStream, jsonChunks } = createFrameDecoder(input)

      // Pre-create stream 3
      const stream3 = getOrCreateStream(3)

      // Drain JSON
      const jsonReader = jsonChunks.getReader()
      await jsonReader.read()

      const reader = stream3.getReader()

      // Stream was created but then errored
      // Reading should throw the error
      let errorCaught = false
      let chunkReceived = false
      try {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          if (value) chunkReceived = true
        }
      } catch (error) {
        errorCaught = true
        expect((error as Error).message).toBe('Stream failed')
      }

      // Either we got the chunk before error, or we got error immediately
      // The important thing is that the error was thrown
      expect(errorCaught).toBe(true)
    })

    it('should preserve stream after END frame for late consumers', async () => {
      // This tests a race condition fix: stream should still be available
      // even if END frame is processed before getOrCreateStream is called
      const jsonFrame = encodeJSONFrame('{"streamRef":7}')
      const chunkFrame = encodeChunkFrame(7, new Uint8Array([42, 43, 44]))
      const endFrame = encodeEndFrame(7)

      const combined = new Uint8Array(
        jsonFrame.length + chunkFrame.length + endFrame.length,
      )
      combined.set(jsonFrame, 0)
      combined.set(chunkFrame, jsonFrame.length)
      combined.set(endFrame, jsonFrame.length + chunkFrame.length)

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(combined)
          controller.close()
        },
      })

      const { getOrCreateStream, jsonChunks } = createFrameDecoder(input)

      // First, fully consume JSON stream (this processes all frames)
      const jsonReader = jsonChunks.getReader()
      const chunks: Array<string> = []
      while (true) {
        const { done, value } = await jsonReader.read()
        if (done) break
        chunks.push(value)
      }
      expect(chunks).toEqual(['{"streamRef":7}'])

      // Now call getOrCreateStream AFTER all frames processed (including END)
      // This simulates deserializer calling getOrCreateStream late
      const stream7 = getOrCreateStream(7)

      // The stream should still have the data that was enqueued
      const rawReader = stream7.getReader()
      const { value, done } = await rawReader.read()

      expect(done).toBe(false)
      expect(value).toEqual(new Uint8Array([42, 43, 44]))

      // Next read should be done (stream was closed by END frame)
      const { done: finalDone } = await rawReader.read()
      expect(finalDone).toBe(true)
    })

    it('should handle CHUNK creating stream before getOrCreateStream called', async () => {
      // CHUNK frame arrives first and creates stream internally,
      // then getOrCreateStream returns the same stream with data
      const chunkFrame1 = encodeChunkFrame(9, new Uint8Array([1, 2]))
      const chunkFrame2 = encodeChunkFrame(9, new Uint8Array([3, 4]))
      const endFrame = encodeEndFrame(9)
      const jsonFrame = encodeJSONFrame('{"ref":9}')

      // Order: CHUNK, CHUNK, END, then JSON (unusual but valid)
      const combined = new Uint8Array(
        chunkFrame1.length +
          chunkFrame2.length +
          endFrame.length +
          jsonFrame.length,
      )
      let offset = 0
      for (const frame of [chunkFrame1, chunkFrame2, endFrame, jsonFrame]) {
        combined.set(frame, offset)
        offset += frame.length
      }

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(combined)
          controller.close()
        },
      })

      const { getOrCreateStream, jsonChunks } = createFrameDecoder(input)

      // Drain JSON (processes all frames)
      const jsonReader = jsonChunks.getReader()
      while (true) {
        const { done } = await jsonReader.read()
        if (done) break
      }

      // Now get the stream - should have all the data
      const stream9 = getOrCreateStream(9)
      const reader = stream9.getReader()

      const { value: v1 } = await reader.read()
      expect(v1).toEqual(new Uint8Array([1, 2]))

      const { value: v2 } = await reader.read()
      expect(v2).toEqual(new Uint8Array([3, 4]))

      const { done: finalDone } = await reader.read()
      expect(finalDone).toBe(true)
    })

    it('should reassemble a chunk payload that spans many small reads', async () => {
      // A large binary payload delivered in tiny network reads forces the
      // multi-chunk (copy) path; the contiguous fast path must not change the
      // reassembled bytes.
      const payload = new Uint8Array(300)
      for (let i = 0; i < payload.length; i++) payload[i] = i % 256

      const jsonFrame = encodeJSONFrame('{"ref":11}')
      const chunkFrame = encodeChunkFrame(11, payload)
      const endFrame = encodeEndFrame(11)

      const combined = new Uint8Array(
        jsonFrame.length + chunkFrame.length + endFrame.length,
      )
      combined.set(jsonFrame, 0)
      combined.set(chunkFrame, jsonFrame.length)
      combined.set(endFrame, jsonFrame.length + chunkFrame.length)

      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          // 7-byte reads: smaller than the 9-byte header and the payload, so
          // both header and payload span multiple buffered chunks.
          for (let i = 0; i < combined.length; i += 7) {
            controller.enqueue(combined.subarray(i, i + 7))
          }
          controller.close()
        },
      })

      const { getOrCreateStream, jsonChunks } = createFrameDecoder(input)
      const stream11 = getOrCreateStream(11)

      const jsonReader = jsonChunks.getReader()
      const { value: jsonValue } = await jsonReader.read()
      expect(jsonValue).toBe('{"ref":11}')

      const rawReader = stream11.getReader()
      const received: Array<number> = []
      while (true) {
        const { done, value } = await rawReader.read()
        if (done) break
        if (value) received.push(...value)
      }
      expect(received).toEqual(Array.from(payload))
    })
  })
})
