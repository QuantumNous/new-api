import { describe, expect, it } from 'vitest'
import {
  ReplayableStream,
  REPLAYABLE_STREAM_MARKER,
} from '../src/ReplayableStream'

describe('ReplayableStream', () => {
  describe('basic functionality', () => {
    it('should buffer and replay chunks to single consumer', async () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.enqueue(new Uint8Array([4, 5, 6]))
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()

      const chunks: Array<Uint8Array> = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      expect(chunks).toHaveLength(2)
      expect(chunks[0]).toEqual(new Uint8Array([1, 2, 3]))
      expect(chunks[1]).toEqual(new Uint8Array([4, 5, 6]))
    })

    it('should allow multiple independent consumers', async () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([10, 20]))
          controller.enqueue(new Uint8Array([30, 40]))
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)

      // Create two independent replay streams
      const replay1 = replayable.createReplayStream()
      const replay2 = replayable.createReplayStream()

      const reader1 = replay1.getReader()
      const reader2 = replay2.getReader()

      // Read from both independently
      const chunks1: Array<Uint8Array> = []
      const chunks2: Array<Uint8Array> = []

      // Read first chunk from both
      const r1c1 = await reader1.read()
      const r2c1 = await reader2.read()
      if (!r1c1.done) chunks1.push(r1c1.value)
      if (!r2c1.done) chunks2.push(r2c1.value)

      // Read remaining from both
      while (true) {
        const { done, value } = await reader1.read()
        if (done) break
        chunks1.push(value)
      }
      while (true) {
        const { done, value } = await reader2.read()
        if (done) break
        chunks2.push(value)
      }

      // Both should have same data
      expect(chunks1).toHaveLength(2)
      expect(chunks2).toHaveLength(2)
      expect(chunks1[0]).toEqual(new Uint8Array([10, 20]))
      expect(chunks2[0]).toEqual(new Uint8Array([10, 20]))
    })

    it('should support late subscribers (replay from beginning)', async () => {
      let closeController: () => void = () => {}
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.enqueue(new Uint8Array([2]))
          closeController = () => controller.close()
        },
      })

      const replayable = new ReplayableStream(source)

      // First consumer reads immediately
      const replay1 = replayable.createReplayStream()
      const reader1 = replay1.getReader()
      await reader1.read() // Read first chunk

      // Wait a bit for buffering
      await new Promise((r) => setTimeout(r, 10))

      // Close the source
      closeController()

      // Late subscriber should still get all data from beginning
      const replay2 = replayable.createReplayStream()
      const reader2 = replay2.getReader()

      const chunks: Array<Uint8Array> = []
      while (true) {
        const { done, value } = await reader2.read()
        if (done) break
        chunks.push(value)
      }

      expect(chunks).toHaveLength(2)
      expect(chunks[0]).toEqual(new Uint8Array([1]))
      expect(chunks[1]).toEqual(new Uint8Array([2]))
    })

    it('should have REPLAYABLE_STREAM_MARKER', () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)
      expect(replayable[REPLAYABLE_STREAM_MARKER]).toBe(true)
    })
  })

  describe('abort handling', () => {
    it('should abort immediately if signal already aborted', async () => {
      const controller = new AbortController()
      controller.abort()

      const source = new ReadableStream<Uint8Array>({
        start(ctrl) {
          ctrl.enqueue(new Uint8Array([1, 2, 3]))
          ctrl.close()
        },
      })

      const replayable = new ReplayableStream(source, {
        signal: controller.signal,
      })
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()

      // Should close immediately due to abort
      const { done } = await reader.read()
      expect(done).toBe(true)
    })

    it('should close streams when abort signal fires', async () => {
      const abortController = new AbortController()

      let enqueueFn: (chunk: Uint8Array) => void = () => {}
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          enqueueFn = (chunk) => controller.enqueue(chunk)
        },
      })

      const replayable = new ReplayableStream(source, {
        signal: abortController.signal,
      })
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()

      // Enqueue one chunk
      enqueueFn(new Uint8Array([1]))

      // Read it
      const { value, done } = await reader.read()
      expect(done).toBe(false)
      expect(value).toEqual(new Uint8Array([1]))

      // Abort
      abortController.abort()

      // Next read should close (not error)
      const result = await reader.read()
      expect(result.done).toBe(true)
    })

    it('should free memory on abort', async () => {
      const abortController = new AbortController()

      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array(1000))
          controller.enqueue(new Uint8Array(1000))
        },
      })

      const replayable = new ReplayableStream(source, {
        signal: abortController.signal,
      })

      // Wait for buffering
      await new Promise((r) => setTimeout(r, 10))

      // Abort - should clear internal buffer
      abortController.abort()

      // Creating new replay should return empty/closed stream
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()
      const { done } = await reader.read()
      expect(done).toBe(true)
    })
  })

  describe('error handling', () => {
    it('should propagate source stream errors to consumers', async () => {
      let errorController: (err: Error) => void = () => {}

      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          // Store error function to call later
          errorController = (err) => controller.error(err)
        },
      })

      const replayable = new ReplayableStream(source)
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()

      // First read succeeds
      const { value, done } = await reader.read()
      expect(done).toBe(false)
      expect(value).toEqual(new Uint8Array([1]))

      // Now trigger the error
      errorController(new Error('Source stream failed'))

      // Wait for error to propagate
      await new Promise((r) => setTimeout(r, 10))

      // Next read should error
      await expect(reader.read()).rejects.toThrow('Source stream failed')
    })
  })

  describe('async streaming', () => {
    it('should handle slow source streams', async () => {
      const source = new ReadableStream<Uint8Array>({
        async pull(controller) {
          await new Promise((r) => setTimeout(r, 10))
          controller.enqueue(new Uint8Array([42]))
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()

      const { value, done } = await reader.read()
      expect(done).toBe(false)
      expect(value).toEqual(new Uint8Array([42]))

      const { done: finalDone } = await reader.read()
      expect(finalDone).toBe(true)
    })

    it('should allow consumer to read faster than producer', async () => {
      let enqueueCount = 0
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          // Enqueue chunks slowly
          const interval = setInterval(() => {
            if (enqueueCount < 3) {
              controller.enqueue(new Uint8Array([enqueueCount]))
              enqueueCount++
            } else {
              clearInterval(interval)
              controller.close()
            }
          }, 5)
        },
      })

      const replayable = new ReplayableStream(source)
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()

      const chunks: Array<Uint8Array> = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      expect(chunks).toHaveLength(3)
      expect(chunks[0]).toEqual(new Uint8Array([0]))
      expect(chunks[1]).toEqual(new Uint8Array([1]))
      expect(chunks[2]).toEqual(new Uint8Array([2]))
    })
  })

  describe('edge cases', () => {
    it('should handle empty source stream', async () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()

      const { done } = await reader.read()
      expect(done).toBe(true)
    })

    it('should handle large number of chunks', async () => {
      const numChunks = 100

      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          for (let i = 0; i < numChunks; i++) {
            controller.enqueue(new Uint8Array([i % 256]))
          }
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()

      const chunks: Array<Uint8Array> = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }

      expect(chunks).toHaveLength(numChunks)
    })

    it('should create multiple replay streams from same source', async () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)

      // Create 5 replay streams
      const replays = Array.from({ length: 5 }, () =>
        replayable.createReplayStream(),
      )

      // All should get same data
      for (const replay of replays) {
        const reader = replay.getReader()
        const { value, done } = await reader.read()
        expect(done).toBe(false)
        expect(value).toEqual(new Uint8Array([1, 2, 3]))

        const { done: finalDone } = await reader.read()
        expect(finalDone).toBe(true)
      }
    })
  })

  describe('memory cleanup', () => {
    it('should not auto-release (replays can come at unpredictable times)', async () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)
      expect(replayable.isReleased()).toBe(false)

      // Create and fully consume a replay stream
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()
      await reader.read() // Read chunk
      await reader.read() // Read close

      // Wait for async operations
      await new Promise((r) => setTimeout(r, 10))

      // Should NOT be auto-released (another replay might come later)
      expect(replayable.isReleased()).toBe(false)

      // Can still create another replay
      const replay2 = replayable.createReplayStream()
      const reader2 = replay2.getReader()
      const { value } = await reader2.read()
      expect(value).toEqual(new Uint8Array([1, 2, 3]))
    })

    it('should allow explicit release()', async () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)
      await new Promise((r) => setTimeout(r, 10)) // Wait for buffering

      expect(replayable.isReleased()).toBe(false)

      replayable.release()

      expect(replayable.isReleased()).toBe(true)
    })

    it('should return empty stream after release()', async () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1, 2, 3]))
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)
      await new Promise((r) => setTimeout(r, 10))

      // Release explicitly
      replayable.release()

      // New replay should return empty/closed stream
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()
      const { done } = await reader.read()
      expect(done).toBe(true)
    })

    it('should cancel upstream when release() is called', async () => {
      let canceledReason: unknown
      let resolveCancel: () => void
      const cancelCalled = new Promise<void>((resolve) => {
        resolveCancel = resolve
      })

      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
        },
        cancel(reason) {
          canceledReason = reason
          resolveCancel()
        },
      })

      const replayable = new ReplayableStream(source)

      // Ensure the pump reads at least one chunk.
      const replay = replayable.createReplayStream()
      const replayReader = replay.getReader()
      await replayReader.read()

      replayable.release()
      await cancelCalled

      expect(canceledReason).toBeInstanceOf(Error)
    })

    it('should close active replay stream when release() is called mid-stream', async () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.enqueue(new Uint8Array([2]))
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)
      await new Promise((r) => setTimeout(r, 10))

      // Create replay and read first chunk
      const replay = replayable.createReplayStream()
      const reader = replay.getReader()
      await reader.read() // Read first chunk

      // Release mid-stream
      replayable.release()

      // Next read should get close (stream closed early)
      const { done } = await reader.read()
      expect(done).toBe(true)

      expect(replayable.isReleased()).toBe(true)
    })

    it('should support multiple sequential replays before release', async () => {
      const source = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new Uint8Array([1]))
          controller.close()
        },
      })

      const replayable = new ReplayableStream(source)
      await new Promise((r) => setTimeout(r, 10))

      // First replay - full read
      const replay1 = replayable.createReplayStream()
      const reader1 = replay1.getReader()
      await reader1.read()
      await reader1.read()

      // Should not be released
      expect(replayable.isReleased()).toBe(false)

      // Second replay - full read
      const replay2 = replayable.createReplayStream()
      const reader2 = replay2.getReader()
      const { value } = await reader2.read()
      expect(value).toEqual(new Uint8Array([1]))
      await reader2.read()

      // Still not released
      expect(replayable.isReleased()).toBe(false)

      // Now release
      replayable.release()
      expect(replayable.isReleased()).toBe(true)
    })
  })
})
