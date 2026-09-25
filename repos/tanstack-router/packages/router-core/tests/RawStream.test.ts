import { describe, expect, it } from 'vitest'
import { toCrossJSONAsync, fromCrossJSON } from 'seroval'
import {
  RawStream,
  createRawStreamRPCPlugin,
  createRawStreamDeserializePlugin,
} from '../src/ssr/serializer/RawStream'

describe('RawStream', () => {
  describe('RawStream class', () => {
    it('should wrap a ReadableStream<Uint8Array>', () => {
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })
      const rawStream = new RawStream(stream)
      expect(rawStream.stream).toBe(stream)
    })

    it('should be an instance of RawStream', () => {
      const stream = new ReadableStream<Uint8Array>()
      const rawStream = new RawStream(stream)
      expect(rawStream instanceof RawStream).toBe(true)
    })

    it('should default to binary hint', () => {
      const stream = new ReadableStream<Uint8Array>()
      const rawStream = new RawStream(stream)
      expect(rawStream.hint).toBe('binary')
    })

    it('should accept binary hint option', () => {
      const stream = new ReadableStream<Uint8Array>()
      const rawStream = new RawStream(stream, { hint: 'binary' })
      expect(rawStream.hint).toBe('binary')
    })

    it('should accept text hint option', () => {
      const stream = new ReadableStream<Uint8Array>()
      const rawStream = new RawStream(stream, { hint: 'text' })
      expect(rawStream.hint).toBe('text')
    })
  })

  describe('createRawStreamRPCPlugin', () => {
    it('should call onRawStream callback with stream id and stream', async () => {
      const collectedStreams = new Map<number, ReadableStream<Uint8Array>>()

      const plugin = createRawStreamRPCPlugin((id, stream) => {
        collectedStreams.set(id, stream)
      })

      const testStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })

      const rawStream = new RawStream(testStream)

      await toCrossJSONAsync(rawStream, {
        refs: new Map(),
        plugins: [plugin],
      })

      expect(collectedStreams.size).toBe(1)
      // Stream ID is assigned by our internal counter (sequential starting at 1)
      const streamEntry = Array.from(collectedStreams.entries())[0]
      expect(streamEntry).toBeDefined()
      expect(streamEntry![1]).toBe(testStream)
    })

    it('should serialize with tss/RawStream tag', async () => {
      const plugin = createRawStreamRPCPlugin(() => {})

      const testStream = new ReadableStream<Uint8Array>()
      const rawStream = new RawStream(testStream)

      const serialized = await toCrossJSONAsync(rawStream, {
        refs: new Map(),
        plugins: [plugin],
      })

      // The serialized output should have the plugin tag and contain streamId
      const jsonStr = JSON.stringify(serialized)
      expect(jsonStr).toContain('tss/RawStream')
      expect(jsonStr).toContain('streamId')
    })

    it('should collect multiple streams with unique ids', async () => {
      const collectedStreams = new Map<number, ReadableStream<Uint8Array>>()

      const plugin = createRawStreamRPCPlugin((id, stream) => {
        collectedStreams.set(id, stream)
      })

      const stream1 = new ReadableStream<Uint8Array>()
      const stream2 = new ReadableStream<Uint8Array>()

      const data = {
        first: new RawStream(stream1),
        second: new RawStream(stream2),
      }

      await toCrossJSONAsync(data, {
        refs: new Map(),
        plugins: [plugin],
      })

      expect(collectedStreams.size).toBe(2)
      const ids = Array.from(collectedStreams.keys())
      expect(ids[0]).not.toBe(ids[1])
    })
  })

  describe('createRawStreamDeserializePlugin', () => {
    it('should reconstruct stream from getOrCreateStream function', () => {
      const mockStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([42]))
          controller.close()
        },
      })

      const streams = new Map<number, ReadableStream<Uint8Array>>()
      streams.set(5, mockStream)

      // getOrCreateStream function that returns from map
      const getOrCreateStream = (id: number) => {
        let stream = streams.get(id)
        if (!stream) {
          stream = new ReadableStream<Uint8Array>()
          streams.set(id, stream)
        }
        return stream
      }

      const plugin = createRawStreamDeserializePlugin(getOrCreateStream)

      // Simulate seroval calling deserialize with a node
      const node = { streamId: 5 }

      // Access the deserialize function directly
      const deserializedStream = (plugin as any).deserialize(node, {})

      expect(deserializedStream).toBe(mockStream)
    })

    it('should create stream if not found', () => {
      const streams = new Map<number, ReadableStream<Uint8Array>>()

      const getOrCreateStream = (id: number) => {
        let stream = streams.get(id)
        if (!stream) {
          stream = new ReadableStream<Uint8Array>()
          streams.set(id, stream)
        }
        return stream
      }

      const plugin = createRawStreamDeserializePlugin(getOrCreateStream)

      const node = { streamId: 999 }

      const result = (plugin as any).deserialize(node, {})
      expect(result).toBeInstanceOf(ReadableStream)
      expect(streams.get(999)).toBe(result)
    })
  })

  describe('round-trip serialization', () => {
    it('should serialize and deserialize RawStream correctly', async () => {
      // Collect streams during serialization
      const collectedStreams = new Map<number, ReadableStream<Uint8Array>>()
      const rpcPlugin = createRawStreamRPCPlugin((id, stream) => {
        collectedStreams.set(id, stream)
      })

      const testStream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })

      const data = {
        message: 'test',
        rawData: new RawStream(testStream),
      }

      // Serialize using RPC plugin
      const refs = new Map()
      const serialized = await toCrossJSONAsync(data, {
        refs,
        plugins: [rpcPlugin],
      })

      // Verify we collected the stream
      expect(collectedStreams.size).toBe(1)
      const streamId = Array.from(collectedStreams.keys())[0]!

      // Create getOrCreateStream function
      const getOrCreateStream = (id: number) => {
        const stream = collectedStreams.get(id)
        if (!stream) {
          throw new Error(`Stream ${id} not found in collected streams`)
        }
        return stream
      }

      // Create deserialize plugin with function
      const deserializePlugin =
        createRawStreamDeserializePlugin(getOrCreateStream)

      // Deserialize
      const deserialized = fromCrossJSON(serialized, {
        refs: new Map(),
        plugins: [deserializePlugin],
      }) as any

      expect(deserialized.message).toBe('test')
      expect(deserialized.rawData).toBe(testStream)
    })
  })
})
