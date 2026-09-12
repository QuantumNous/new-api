import { describe, expect, it } from 'vitest'
import {
  FRAME_HEADER_SIZE,
  FrameType,
  createMultiplexedStream,
  encodeChunkFrame,
  encodeEndFrame,
  encodeErrorFrame,
  encodeFrame,
  encodeJSONFrame,
} from '../src/frame-protocol'

describe('frame-protocol', () => {
  describe('encodeFrame', () => {
    it('should encode frame with header and payload', () => {
      const payload = new Uint8Array([1, 2, 3, 4])
      const frame = encodeFrame(FrameType.CHUNK, 42, payload)

      expect(frame.length).toBe(FRAME_HEADER_SIZE + payload.length)

      // Check header
      const view = new DataView(frame.buffer)
      expect(view.getUint8(0)).toBe(FrameType.CHUNK)
      expect(view.getUint32(1, false)).toBe(42) // streamId big-endian
      expect(view.getUint32(5, false)).toBe(4) // length big-endian

      // Check payload
      expect(frame.slice(FRAME_HEADER_SIZE)).toEqual(payload)
    })

    it('should handle empty payload', () => {
      const frame = encodeFrame(FrameType.END, 1, new Uint8Array(0))

      expect(frame.length).toBe(FRAME_HEADER_SIZE)

      const view = new DataView(frame.buffer)
      expect(view.getUint8(0)).toBe(FrameType.END)
      expect(view.getUint32(5, false)).toBe(0) // length is 0
    })
  })

  describe('encodeJSONFrame', () => {
    it('should encode JSON string as frame type 0 with streamId 0', () => {
      const json = '{"hello":"world"}'
      const frame = encodeJSONFrame(json)

      const view = new DataView(frame.buffer)
      expect(view.getUint8(0)).toBe(FrameType.JSON)
      expect(view.getUint32(1, false)).toBe(0) // streamId always 0 for JSON

      const encoder = new TextEncoder()
      const expectedPayload = encoder.encode(json)
      expect(view.getUint32(5, false)).toBe(expectedPayload.length)

      const payload = frame.slice(FRAME_HEADER_SIZE)
      expect(new TextDecoder().decode(payload)).toBe(json)
    })
  })

  describe('encodeChunkFrame', () => {
    it('should encode binary chunk with frame type CHUNK', () => {
      const chunk = new Uint8Array([0xff, 0xfe, 0xfd])
      const frame = encodeChunkFrame(123, chunk)

      const view = new DataView(frame.buffer)
      expect(view.getUint8(0)).toBe(FrameType.CHUNK)
      expect(view.getUint32(1, false)).toBe(123)
      expect(view.getUint32(5, false)).toBe(3)

      expect(frame.slice(FRAME_HEADER_SIZE)).toEqual(chunk)
    })
  })

  describe('encodeEndFrame', () => {
    it('should encode end frame with empty payload', () => {
      const frame = encodeEndFrame(456)

      expect(frame.length).toBe(FRAME_HEADER_SIZE)

      const view = new DataView(frame.buffer)
      expect(view.getUint8(0)).toBe(FrameType.END)
      expect(view.getUint32(1, false)).toBe(456)
      expect(view.getUint32(5, false)).toBe(0)
    })
  })

  describe('encodeErrorFrame', () => {
    it('should encode Error message', () => {
      const frame = encodeErrorFrame(789, new Error('Something went wrong'))

      const view = new DataView(frame.buffer)
      expect(view.getUint8(0)).toBe(FrameType.ERROR)
      expect(view.getUint32(1, false)).toBe(789)

      const payload = frame.slice(FRAME_HEADER_SIZE)
      expect(new TextDecoder().decode(payload)).toBe('Something went wrong')
    })

    it('should handle non-Error values', () => {
      const frame = encodeErrorFrame(1, 'string error')

      const payload = frame.slice(FRAME_HEADER_SIZE)
      expect(new TextDecoder().decode(payload)).toBe('string error')
    })

    it('should handle undefined error', () => {
      const frame = encodeErrorFrame(1, undefined)

      const payload = frame.slice(FRAME_HEADER_SIZE)
      expect(new TextDecoder().decode(payload)).toBe('Unknown error')
    })
  })

  describe('createMultiplexedStream', () => {
    it('should multiplex JSON stream only', async () => {
      const jsonStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('{"data":1}')
          controller.enqueue('{"data":2}')
          controller.close()
        },
      })

      const multiplexed = createMultiplexedStream(
        jsonStream,
        new Map(), // no raw streams
      )

      const reader = multiplexed.getReader()
      const chunks: Array<Uint8Array> = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      expect(chunks.length).toBe(2)

      // Both should be JSON frames
      for (const chunk of chunks) {
        const view = new DataView(chunk.buffer, chunk.byteOffset)
        expect(view.getUint8(0)).toBe(FrameType.JSON)
      }
    })

    it('should multiplex JSON and raw streams', async () => {
      const jsonStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('{"result":"ok"}')
          controller.close()
        },
      })

      const rawStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })

      const rawStreams = new Map<number, ReadableStream<Uint8Array>>()
      rawStreams.set(5, rawStream)

      const multiplexed = createMultiplexedStream(jsonStream, rawStreams)

      const reader = multiplexed.getReader()
      const chunks: Array<Uint8Array> = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      // Should have: JSON frame, CHUNK frame, END frame
      expect(chunks.length).toBe(3)

      const types = chunks.map((chunk) => {
        const view = new DataView(chunk.buffer, chunk.byteOffset)
        return view.getUint8(0)
      })

      expect(types).toContain(FrameType.JSON)
      expect(types).toContain(FrameType.CHUNK)
      expect(types).toContain(FrameType.END)
    })

    it('should handle cancel without errors', async () => {
      // Create slow streams that won't complete before cancel
      let jsonCancelled = false
      let rawCancelled = false

      const jsonStream = new ReadableStream<string>({
        async start(controller) {
          await new Promise((r) => setTimeout(r, 100))
          controller.enqueue('{}\n')
          controller.close()
        },
        cancel() {
          jsonCancelled = true
        },
      })

      const rawStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          await new Promise((r) => setTimeout(r, 100))
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
        cancel() {
          rawCancelled = true
        },
      })

      const rawStreams = new Map<number, ReadableStream<Uint8Array>>()
      rawStreams.set(1, rawStream)

      const multiplexed = createMultiplexedStream(jsonStream, rawStreams)
      const reader = multiplexed.getReader()

      // Cancel immediately before streams complete
      // Should not throw ERR_INVALID_STATE
      await reader.cancel()

      // Underlying reader.cancel should propagate to sources
      expect(jsonCancelled).toBe(true)
      expect(rawCancelled).toBe(true)
    })

    it('should interleave multiple raw streams correctly', async () => {
      // Two streams that emit chunks with different timing
      let resolve1: () => void
      let resolve2: () => void
      const gate1 = new Promise<void>((r) => (resolve1 = r))
      const gate2 = new Promise<void>((r) => (resolve2 = r))

      const jsonStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('{"streams":[1,2]}')
          controller.close()
        },
      })

      const rawStream1 = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new Uint8Array([0x11]))
          await gate1
          controller.enqueue(new Uint8Array([0x12]))
          controller.close()
        },
      })

      const rawStream2 = new ReadableStream<Uint8Array>({
        async start(controller) {
          controller.enqueue(new Uint8Array([0x21]))
          await gate2
          controller.enqueue(new Uint8Array([0x22]))
          controller.close()
        },
      })

      const rawStreams = new Map<number, ReadableStream<Uint8Array>>()
      rawStreams.set(1, rawStream1)
      rawStreams.set(2, rawStream2)

      const multiplexed = createMultiplexedStream(jsonStream, rawStreams)
      const reader = multiplexed.getReader()

      const chunks: Array<Uint8Array> = []

      // Read first batch (JSON + first chunks from both streams)
      for (let i = 0; i < 3; i++) {
        const { value } = await reader.read()
        if (value) chunks.push(value)
      }

      // Release gates to let streams continue
      resolve1!()
      resolve2!()

      // Read remaining chunks
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      // Should have: 1 JSON + 2 CHUNKs + 2 CHUNKs + 2 ENDs = 7 frames
      expect(chunks.length).toBe(7)

      // Verify all frame types present
      const types = chunks.map((chunk) => {
        const view = new DataView(chunk.buffer, chunk.byteOffset)
        return view.getUint8(0)
      })

      expect(types.filter((t) => t === FrameType.JSON).length).toBe(1)
      expect(types.filter((t) => t === FrameType.CHUNK).length).toBe(4)
      expect(types.filter((t) => t === FrameType.END).length).toBe(2)
    })

    it('should handle late stream registration', async () => {
      const jsonStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('{"ref":99}')
          controller.close()
        },
      })

      // Late stream source that emits a registration after a delay
      // (ensures framed protocol doesn't miss late-stream messages)
      let resolveGate: () => void
      const gate = new Promise<void>((r) => (resolveGate = r))

      const lateStreamSource = new ReadableStream<{
        id: number
        stream: ReadableStream<Uint8Array>
      }>({
        async start(controller) {
          await gate
          controller.enqueue({
            id: 99,
            stream: new ReadableStream<Uint8Array>({
              start(c) {
                c.enqueue(new Uint8Array([0xaa, 0xbb]))
                c.close()
              },
            }),
          })
          controller.close()
        },
      })

      const multiplexed = createMultiplexedStream(
        jsonStream,
        new Map(),
        lateStreamSource,
      )

      const reader = multiplexed.getReader()
      const chunks: Array<Uint8Array> = []

      // Read JSON frame first
      const { value: jsonChunk } = await reader.read()
      if (jsonChunk) chunks.push(jsonChunk)

      // Release gate to let late stream arrive
      resolveGate!()

      // Read remaining frames
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      // Should have: JSON, CHUNK, END
      expect(chunks.length).toBe(3)

      const types = chunks.map((chunk) => {
        const view = new DataView(chunk.buffer, chunk.byteOffset)
        return view.getUint8(0)
      })

      expect(types).toEqual([FrameType.JSON, FrameType.CHUNK, FrameType.END])

      // Verify late stream data
      const chunkFrame = chunks[1]!
      const view = new DataView(chunkFrame.buffer, chunkFrame.byteOffset)
      expect(view.getUint32(1, false)).toBe(99) // streamId
      expect(chunkFrame.slice(FRAME_HEADER_SIZE)).toEqual(
        new Uint8Array([0xaa, 0xbb]),
      )
    })

    it('should handle late stream registration even if JSON is delayed', async () => {
      let startJson: () => void
      const jsonGate = new Promise<void>((r) => (startJson = r))

      const jsonStream = new ReadableStream<string>({
        async start(controller) {
          await jsonGate
          controller.enqueue('{"ref":1}')
          controller.close()
        },
      })

      // Late stream registers immediately (before JSON starts)
      const lateStreamSource = new ReadableStream<{
        id: number
        stream: ReadableStream<Uint8Array>
      }>({
        start(controller) {
          controller.enqueue({
            id: 1,
            stream: new ReadableStream<Uint8Array>({
              start(c) {
                c.enqueue(new Uint8Array([0x01]))
                c.close()
              },
            }),
          })
          controller.close()
        },
      })

      const multiplexed = createMultiplexedStream(
        jsonStream,
        new Map(),
        lateStreamSource,
      )

      const reader = multiplexed.getReader()
      const chunks: Array<Uint8Array> = []

      // Allow late stream to run before JSON
      await Promise.resolve()
      startJson!()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      const types = chunks.map((chunk) => {
        const view = new DataView(chunk.buffer, chunk.byteOffset)
        return view.getUint8(0)
      })

      // Order is not strictly guaranteed, but all frames must be present.
      expect(types.filter((t) => t === FrameType.JSON).length).toBe(1)
      expect(types.filter((t) => t === FrameType.CHUNK).length).toBe(1)
      expect(types.filter((t) => t === FrameType.END).length).toBe(1)
    })

    it('should handle multiple late stream registrations', async () => {
      const jsonStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('{}')
          controller.close()
        },
      })

      const lateStreamSource = new ReadableStream<{
        id: number
        stream: ReadableStream<Uint8Array>
      }>({
        start(controller) {
          // Register two streams
          controller.enqueue({
            id: 10,
            stream: new ReadableStream<Uint8Array>({
              start(c) {
                c.enqueue(new Uint8Array([10]))
                c.close()
              },
            }),
          })
          controller.enqueue({
            id: 20,
            stream: new ReadableStream<Uint8Array>({
              start(c) {
                c.enqueue(new Uint8Array([20]))
                c.close()
              },
            }),
          })
          controller.close()
        },
      })

      const multiplexed = createMultiplexedStream(
        jsonStream,
        new Map(),
        lateStreamSource,
      )

      const reader = multiplexed.getReader()
      const chunks: Array<Uint8Array> = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      // Should have: JSON, CHUNK(10), END(10), CHUNK(20), END(20)
      // Order may vary but all should be present
      expect(chunks.length).toBe(5)

      const types = chunks.map((chunk) => {
        const view = new DataView(chunk.buffer, chunk.byteOffset)
        return view.getUint8(0)
      })

      expect(types.filter((t) => t === FrameType.JSON).length).toBe(1)
      expect(types.filter((t) => t === FrameType.CHUNK).length).toBe(2)
      expect(types.filter((t) => t === FrameType.END).length).toBe(2)
    })

    it('should interleave initial and late streams', async () => {
      let resolveJson: () => void
      const jsonGate = new Promise<void>((r) => (resolveJson = r))

      const jsonStream = new ReadableStream<string>({
        async start(controller) {
          controller.enqueue('{"first":true}')
          await jsonGate
          controller.enqueue('{"second":true}')
          controller.close()
        },
      })

      // Initial raw stream
      const initialRaw = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.close()
        },
      })

      const rawStreams = new Map<number, ReadableStream<Uint8Array>>()
      rawStreams.set(1, initialRaw)

      // Late stream arrives after first JSON
      const lateStreamSource = new ReadableStream<{
        id: number
        stream: ReadableStream<Uint8Array>
      }>({
        start(controller) {
          controller.enqueue({
            id: 2,
            stream: new ReadableStream<Uint8Array>({
              start(c) {
                c.enqueue(new Uint8Array([2]))
                c.close()
              },
            }),
          })
          controller.close()
        },
      })

      const multiplexed = createMultiplexedStream(
        jsonStream,
        rawStreams,
        lateStreamSource,
      )

      const reader = multiplexed.getReader()
      const chunks: Array<Uint8Array> = []

      // Read a few frames
      for (let i = 0; i < 4; i++) {
        const { value, done } = await reader.read()
        if (done) break
        if (value) chunks.push(value)
      }

      // Release JSON to complete
      resolveJson!()

      // Read remaining
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      // Should have: 2 JSON + 2 CHUNK + 2 END = 6 frames
      expect(chunks.length).toBe(6)

      const types = chunks.map((chunk) => {
        const view = new DataView(chunk.buffer, chunk.byteOffset)
        return view.getUint8(0)
      })

      expect(types.filter((t) => t === FrameType.JSON).length).toBe(2)
      expect(types.filter((t) => t === FrameType.CHUNK).length).toBe(2)
      expect(types.filter((t) => t === FrameType.END).length).toBe(2)
    })

    it('should handle raw stream error', async () => {
      const jsonStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('{}')
          controller.close()
        },
      })

      const errorStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.error(new Error('Stream failed'))
        },
      })

      const rawStreams = new Map<number, ReadableStream<Uint8Array>>()
      rawStreams.set(10, errorStream)

      const multiplexed = createMultiplexedStream(jsonStream, rawStreams)

      const reader = multiplexed.getReader()
      const chunks: Array<Uint8Array> = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      // Should have JSON frame and ERROR frame
      const types = chunks.map((chunk) => {
        const view = new DataView(chunk.buffer, chunk.byteOffset)
        return view.getUint8(0)
      })

      expect(types).toContain(FrameType.JSON)
      expect(types).toContain(FrameType.ERROR)

      // Find ERROR frame and check content
      const errorFrame = chunks.find((chunk) => {
        const view = new DataView(chunk.buffer, chunk.byteOffset)
        return view.getUint8(0) === FrameType.ERROR
      })

      expect(errorFrame).toBeDefined()
      const payload = errorFrame!.slice(FRAME_HEADER_SIZE)
      expect(new TextDecoder().decode(payload)).toBe('Stream failed')
    })

    it('should propagate JSON stream error to output (fatal)', async () => {
      let errorController: ReadableStreamDefaultController<string>
      const jsonStream = new ReadableStream<string>({
        start(controller) {
          errorController = controller
          controller.enqueue('{"first":true}')
        },
      })

      const rawStream = new ReadableStream<Uint8Array>({
        async start(controller) {
          // Slow stream - should be cancelled when JSON errors
          await new Promise((r) => setTimeout(r, 100))
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })

      const rawStreams = new Map<number, ReadableStream<Uint8Array>>()
      rawStreams.set(1, rawStream)

      const multiplexed = createMultiplexedStream(jsonStream, rawStreams)
      const reader = multiplexed.getReader()

      // Should be able to read first JSON frame
      const { value: firstChunk } = await reader.read()
      expect(firstChunk).toBeDefined()
      const view = new DataView(firstChunk!.buffer, firstChunk!.byteOffset)
      expect(view.getUint8(0)).toBe(FrameType.JSON)

      // Now error the JSON stream
      errorController!.error(new Error('JSON serialization failed'))

      // Next read should throw the JSON stream error
      await expect(reader.read()).rejects.toThrow('JSON serialization failed')
    })

    it('should not hang when raw stream never ends', async () => {
      // This tests the fix for hanging requests
      const jsonStream = new ReadableStream<string>({
        start(controller) {
          controller.enqueue('{}')
          controller.close()
        },
      })

      let rawStreamCancelled = false
      const neverEndingStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          // Never close or error - simulates a hanging stream
        },
        cancel() {
          rawStreamCancelled = true
        },
      })

      const rawStreams = new Map<number, ReadableStream<Uint8Array>>()
      rawStreams.set(1, neverEndingStream)

      const multiplexed = createMultiplexedStream(jsonStream, rawStreams)
      const reader = multiplexed.getReader()

      // Read first two frames (JSON and CHUNK)
      const { value: jsonFrame } = await reader.read()
      expect(jsonFrame).toBeDefined()

      const { value: chunkFrame } = await reader.read()
      expect(chunkFrame).toBeDefined()

      // Cancel the output stream
      await reader.cancel()

      // The underlying raw stream should be cancelled
      expect(rawStreamCancelled).toBe(true)
    })
  })
})
