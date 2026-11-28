/**
 * ReplayableStream is used for React Server Components (RSC) / Flight streams.
 *
 * In this package the same Flight payload may need to be:
 * - decoded for SSR (render path), and/or
 * - serialized for transport to the client for client-side decoding.
 *
 * Call sites:
 * - `src/createServerComponent.ts`: wraps the produced Flight stream once.
 * - `src/serialization.ts`: uses `createReplayStream()` to transport a fresh stream
 *   to the client via `RawStream`.
 *
 * Constraints:
 * - Consumption order isn't fixed: SSR decode might start first or transport might
 *   start first depending on the request path.
 * - Sometimes only one happens (e.g. when client calls server function directly).
 *
 * Why not just `ReadableStream.tee()`?
 * - tee() must be called up-front before the stream is consumed/locked and only
 *   creates two live branches (no late "replay from byte 0").
 * - If one branch is slower or never consumed, the runtime may buffer internally
 *   to keep branches consistent, which can retain large Flight payloads longer
 *   than intended and makes cleanup less explicit.
 *
 * ReplayableStream reads once, buffers explicitly, can mint replay streams on
 * demand, and centralizes cancellation so aborting can stop upstream work and
 * free buffered data deterministically.
 *
 * Memory Management:
 * - Memory is released when the abort signal fires (request cancelled)
 * - Call `release()` to force immediate cleanup if no more replays are needed
 * - No automatic release: replays can be created at unpredictable times (SSR decode
 *   finishes before serialization starts), so we can't safely auto-release
 */

export interface ReplayableStreamOptions {
  signal?: AbortSignal
}

// Use Symbol.for to ensure the same symbol across different module instances
export const REPLAYABLE_STREAM_MARKER = Symbol.for(
  'tanstack.rsc.ReplayableStream',
)

export class ReplayableStream<T = Uint8Array> {
  // Marker for cross-environment instance checking
  readonly [REPLAYABLE_STREAM_MARKER] = true

  private chunks: Array<T> = []
  private done = false
  private error: unknown = null
  private waiter: PromiseWithResolvers<void> | null = null
  private aborted = false
  private released = false

  private sourceReader: ReadableStreamDefaultReader<T> | null = null
  private abortSignal: AbortSignal | undefined
  private abortListener: (() => void) | null = null

  constructor(
    private source: ReadableStream<T>,
    private options: ReplayableStreamOptions = {},
  ) {
    this.abortSignal = options.signal
    this.start()
  }

  private start(): void {
    const signal = this.abortSignal

    if (signal?.aborted) {
      this.handleAbort()
      return
    }

    const onAbort = () => this.handleAbort()
    this.abortListener = onAbort
    signal?.addEventListener('abort', onAbort, { once: true })

    const reader = this.source.getReader()
    this.sourceReader = reader

    const pump = async () => {
      try {
        // Keep reading until upstream ends or we are stopped.
        while (!this.aborted && !this.released) {
          const { done, value } = await reader.read()
          if (done) break
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (this.aborted || this.released) break
          this.chunks.push(value)
          this.notify()
        }
        this.done = true
      } catch (err) {
        if (!this.aborted && !this.released) {
          this.error = err
        }
        this.done = true
      } finally {
        this.detachAbortListener()
        try {
          reader.releaseLock()
        } catch {
          // Ignore
        }
        if (this.sourceReader === reader) {
          this.sourceReader = null
        }
        this.notify()
      }
    }

    pump()
  }

  private detachAbortListener(): void {
    const signal = this.abortSignal
    const listener = this.abortListener
    if (signal && listener) {
      signal.removeEventListener('abort', listener)
    }
    this.abortListener = null
  }

  private cancelSource(reason: unknown): void {
    const reader = this.sourceReader
    this.sourceReader = null

    try {
      reader?.cancel(reason).catch(() => {})
    } catch {
      // Ignore
    }
  }

  private handleAbort(): void {
    if (this.aborted) return
    this.aborted = true
    this.done = true

    // Try to stop upstream work immediately.
    // Cancellation during an abort can throw synchronously in some runtimes
    // (eg when the underlying cancel algorithm throws). Never let that escape
    // an AbortSignal event handler.
    const reason =
      this.abortSignal?.reason ?? new Error('ReplayableStream aborted')

    this.detachAbortListener()
    this.abortSignal = undefined
    this.cancelSource(reason)

    this.chunks = [] // Free memory immediately on abort
    this.released = true
    this.notify()
  }

  private notify(): void {
    if (this.waiter) {
      this.waiter.resolve()
      this.waiter = null
    }
  }

  private wait(): Promise<void> {
    if (this.done || this.released) return Promise.resolve()
    if (!this.waiter) {
      this.waiter = Promise.withResolvers<void>()
    }
    return this.waiter.promise
  }

  /**
   * Explicitly release buffered chunks.
   * Call this when you know no more replay streams will be created.
   * After calling release(), createReplayStream() will return empty streams.
   */
  release(): void {
    if (this.released) return

    this.released = true
    this.chunks = []

    // Release should also stop upstream work and wake any waiters.
    // This is important when a Flight payload is never consumed again
    // (eg. cached loader data that evicts) to avoid retaining upstream resources.
    this.detachAbortListener()
    this.abortSignal = undefined
    this.cancelSource(new Error('ReplayableStream released'))
    this.notify()
  }

  /**
   * Check if the stream data has been released
   */
  isReleased(): boolean {
    return this.released
  }

  /**
   * Create an independent replay stream. Each call returns a fresh reader
   * that starts from the beginning of the buffered data.
   *
   * If the stream has been released, returns a stream that closes immediately.
   */
  createReplayStream(): ReadableStream<T> {
    if (this.released) {
      return new ReadableStream<T>({
        start(controller) {
          controller.close()
        },
      })
    }

    let index = 0

    return new ReadableStream<T>({
      pull: async (controller) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        while (true) {
          if (this.released) {
            controller.close()
            return
          }

          if (index < this.chunks.length) {
            controller.enqueue(this.chunks[index++] as T)
            return
          }

          if (this.done) {
            if (this.error && !this.aborted) {
              controller.error(this.error)
            } else {
              controller.close()
            }
            return
          }

          await this.wait()
        }
      },
      cancel: () => {
        // No-op: consumers canceling a replay should not cancel upstream.
        // Upstream cancellation is controlled by abort/release.
      },
    })
  }
}
