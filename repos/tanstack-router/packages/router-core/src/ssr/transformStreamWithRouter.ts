import { ReadableStream } from 'node:stream/web'
import { Readable } from 'node:stream'
import { TSR_SCRIPT_BARRIER_ID } from './constants'
import type { AnyRouter } from '../router'

export type TransformStreamWithRouterOptions = {
  /** Timeout for serialization to complete after app render finishes (default: 60000ms) */
  timeoutMs?: number
  /** Maximum lifetime of the stream transform (default: 120000ms). Safety net for cleanup. */
  lifetimeMs?: number
  /**
   * Called exactly once when the stream is torn down due to abort/error/
   * cancel/timeout — NOT on natural successful completion. Use this to
   * abort a hidden producer upstream of any PassThrough you passed in
   * (e.g. React `renderToPipeableStream`'s `abort()`).
   * Errors thrown from this callback are swallowed.
   */
  onAbort?: (reason?: unknown) => void
}

export function transformReadableStreamWithRouter(
  router: AnyRouter,
  routerStream: ReadableStream,
  opts?: TransformStreamWithRouterOptions,
) {
  return transformStreamWithRouter(router, routerStream, opts)
}

export function transformPipeableStreamWithRouter(
  router: AnyRouter,
  routerStream: Readable,
  opts?: TransformStreamWithRouterOptions,
) {
  return Readable.fromWeb(
    transformStreamWithRouter(router, Readable.toWeb(routerStream), opts),
  )
}

// Minimum length of a valid closing tag: </a> = 4 characters
const MIN_CLOSING_TAG_LENGTH = 4

// Default timeout values (in milliseconds)
const DEFAULT_SERIALIZATION_TIMEOUT_MS = 60000
const DEFAULT_LIFETIME_TIMEOUT_MS = DEFAULT_SERIALIZATION_TIMEOUT_MS * 2
const MAX_LEFTOVER_CHARS = 2048
const MAX_TAIL_CHARS = 64 * 1024
const MAX_ROUTER_HTML_CHARS = 16 * 1024 * 1024
const MAX_PENDING_WRITE_CHARS = 16 * 1024 * 1024

// Merge lifecycle: body bytes can stream, router HTML must precede tail,
// terminal states own close/error/cleanup exactly once.
const MergeState = {
  ReadingBody: 0,
  HoldingTail: 1,
  AppDone: 2,
  Draining: 3,
  Done: 4,
} as const

type MergeState = (typeof MergeState)[keyof typeof MergeState]

// Module-level encoder (stateless, safe to reuse)
const textEncoder = new TextEncoder()

const noop = () => {}
const resolvedPromise = Promise.resolve()

// Returns -bodyEndIndex - 2 when </body> is found; otherwise returns
// the position after the last valid closing tag, or -1 when none exists.
function findHtmlBoundary(str: string): number {
  let lastClosingTagEnd = -1
  let searchFrom = str.length - MIN_CLOSING_TAG_LENGTH

  while (searchFrom >= 0) {
    const openSlash = str.lastIndexOf('</', searchFrom)
    if (openSlash === -1) break

    // Fast case-insensitive match for </body>. Negative return encodes the
    // body start index without allocating a result object.
    if (
      (str.charCodeAt(openSlash + 2) | 32) === 98 &&
      (str.charCodeAt(openSlash + 3) | 32) === 111 &&
      (str.charCodeAt(openSlash + 4) | 32) === 100 &&
      (str.charCodeAt(openSlash + 5) | 32) === 121 &&
      str.charCodeAt(openSlash + 6) === 62
    ) {
      return -openSlash - 2
    }

    if (lastClosingTagEnd === -1) {
      let i = openSlash + 2
      const startCode = str.charCodeAt(i)
      if (
        (startCode >= 97 && startCode <= 122) ||
        (startCode >= 65 && startCode <= 90)
      ) {
        i++
        while (i < str.length) {
          const code = str.charCodeAt(i)
          if (
            (code >= 97 && code <= 122) || // a-z
            (code >= 65 && code <= 90) || // A-Z
            (code >= 48 && code <= 57) || // 0-9
            code === 95 || // _
            code === 58 || // :
            code === 46 || // .
            code === 45 // -
          ) {
            i++
          } else {
            break
          }
        }

        if (str.charCodeAt(i) === 62) {
          lastClosingTagEnd = i + 1
        }
      }
    }

    searchFrom = openSlash - 1
  }

  return lastClosingTagEnd
}

/**
 * Releasing the lock can throw if a pending read is still settling or if the
 * lock was already released.
 */
type ReaderOps = {
  cancel: (reason?: unknown) => Promise<unknown>
  releaseLock: () => void
}

function safeReleaseReader(reader: ReaderOps) {
  try {
    reader.releaseLock()
    return true
  } catch {
    return false
  }
}

/**
 * Cancel a reader without producing an unhandled rejection. `reader.cancel()`
 * can reject (e.g. when the underlying source's cancel() throws), and
 * downstream cancel() should still wait for upstream teardown when possible.
 */
function safeCancelReader(reader: ReaderOps, reason?: unknown): Promise<void> {
  let cancelPromise: Promise<unknown> | undefined
  try {
    cancelPromise = reader.cancel(reason)
  } catch {
    // ignore
  }

  if (!safeReleaseReader(reader) && cancelPromise) {
    return cancelPromise.then(noop, noop).then(() => {
      safeReleaseReader(reader)
    })
  }

  return cancelPromise ? cancelPromise.then(noop, noop) : resolvedPromise
}

function createReaderState<T>(appStream: ReadableStream<T>) {
  const reader = appStream.getReader()
  let released = false

  return {
    reader,
    cancel: (reason?: unknown) => {
      if (released) return resolvedPromise
      released = true
      return safeCancelReader(reader, reason)
    },
    release: () => {
      if (released) return
      released = true
      safeReleaseReader(reader)
    },
  }
}

function createAbortNotifier(opts?: TransformStreamWithRouterOptions) {
  let abortNotified = false
  return (reason?: unknown) => {
    if (abortNotified) return
    abortNotified = true
    try {
      opts?.onAbort?.(reason)
    } catch {
      // swallow user errors
    }
  }
}

export function transformStreamWithRouter(
  router: AnyRouter,
  appStream: ReadableStream,
  opts?: TransformStreamWithRouterOptions,
) {
  const serverSsr = router.serverSsr
  if (!serverSsr) {
    throw new Error('Invariant failed: router.serverSsr is required')
  }
  if (serverSsr.reserveStreamFastPath()) {
    return makeFastPathStream(appStream, opts, serverSsr)
  }

  return makeMainStream(serverSsr, appStream, opts)
}

// =====================================================================
// Fast path: passthrough with cleanup + backpressure on app reads.
// =====================================================================
function makeFastPathStream(
  appStream: ReadableStream<Uint8Array>,
  opts?: TransformStreamWithRouterOptions,
  serverSsr?: NonNullable<AnyRouter['serverSsr']>,
) {
  let cleanedUp = false
  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  let state: MergeState = MergeState.ReadingBody
  let lifetimeTimeoutHandle: ReturnType<typeof setTimeout> | undefined
  let stopListeningToInjectedHtml: (() => void) | undefined
  const readerState = createReaderState(appStream)
  const notifyAbort = createAbortNotifier(opts)
  const isDone = () => state === MergeState.Done
  let renderFinished = false

  const finishSsrRendering = () => {
    if (!serverSsr || renderFinished) return true
    renderFinished = true
    try {
      serverSsr.setRenderFinished()
      return true
    } catch (error) {
      safeError(error)
      cleanup(error)
      return false
    }
  }

  const cleanup = (reason?: unknown, cancelReader = true) => {
    if (cleanedUp) return resolvedPromise
    cleanedUp = true

    if (lifetimeTimeoutHandle !== undefined) {
      clearTimeout(lifetimeTimeoutHandle)
      lifetimeTimeoutHandle = undefined
    }
    try {
      stopListeningToInjectedHtml?.()
    } catch {
      // ignore
    }
    stopListeningToInjectedHtml = undefined

    if (cancelReader) {
      // Notify the producer immediately. Reader cancellation may take time to
      // settle, and upstream renderers must tolerate abort + cancel overlap.
      notifyAbort(reason)
    }
    const readerDone = cancelReader
      ? readerState.cancel(reason)
      : (readerState.release(), resolvedPromise)
    if (serverSsr) {
      try {
        serverSsr.cleanup()
      } catch (error) {
        console.error('Error in SSR cleanup:', error)
      }
    }
    return readerDone
  }

  const safeClose = () => {
    if (isDone()) return
    state = MergeState.Done
    try {
      controller?.close()
    } catch {
      // ignore
    }
  }

  const safeError = (error: unknown) => {
    if (isDone()) return
    state = MergeState.Done
    try {
      controller?.error(error)
    } catch {
      // ignore
    }
  }

  if (serverSsr) {
    stopListeningToInjectedHtml = serverSsr.onInjectedHtml(() => {
      const err = new Error('SSR router HTML injected during fast path')
      safeError(err)
      cleanup(err)
    })
  }

  const lifetimeMs = opts?.lifetimeMs ?? DEFAULT_LIFETIME_TIMEOUT_MS
  lifetimeTimeoutHandle = setTimeout(() => {
    if (!cleanedUp && !isDone()) {
      const err = new Error('Stream lifetime exceeded')
      console.warn(
        `SSR stream transform exceeded maximum lifetime (${lifetimeMs}ms), forcing cleanup`,
      )
      safeError(err)
      cleanup(err)
    }
  }, lifetimeMs)

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
    async pull(c) {
      if (cleanedUp || isDone()) return
      try {
        const { done, value } = await readerState.reader.read()
        if (!done) {
          if (!cleanedUp && !isDone()) {
            c.enqueue(value)
          }
          return
        }

        if (cleanedUp || isDone()) return

        if (!finishSsrRendering()) return
        safeClose()
        return cleanup(undefined, false)
      } catch (error) {
        if (cleanedUp) return
        console.error('Error reading appStream:', error)
        if (state < MergeState.AppDone) {
          try {
            serverSsr?.setRenderFinished()
          } catch {
            // ignore
          }
        }
        safeError(error)
        return cleanup(error)
      } finally {
        if (cleanedUp || isDone()) {
          readerState.release()
        }
      }
    },
    cancel(reason) {
      state = MergeState.Done
      return cleanup(reason)
    },
  })

  return stream
}

// =====================================================================
// Main path: scan + inject router HTML/scripts with full backpressure.
//
// ALL output (app chunks AND router-injected HTML/scripts) flows through a
// single pendingWrites queue and is only enqueued onto the downstream
// controller when desiredSize > 0. This prevents native-memory growth of
// queued Uint8Arrays under slow HTTP consumers.
// =====================================================================
function makeMainStream(
  serverSsr: NonNullable<AnyRouter['serverSsr']>,
  appStream: ReadableStream,
  opts?: TransformStreamWithRouterOptions,
) {
  let stopListeningToInjectedHtml: (() => void) | undefined
  let stopListeningToSerializationFinished: (() => void) | undefined
  let serializationTimeoutHandle: ReturnType<typeof setTimeout> | undefined
  let lifetimeTimeoutHandle: ReturnType<typeof setTimeout> | undefined
  let cleanedUp = false

  let controller: ReadableStreamDefaultController<Uint8Array> | undefined
  let closeWhenDrained = false
  let state: MergeState = MergeState.ReadingBody

  const readerState = createReaderState(appStream)
  const notifyAbort = createAbortNotifier(opts)

  // Single output queue: app chunks + router-injected HTML/scripts.
  // Stored as STRINGS to avoid holding native-backed Uint8Arrays in our queue
  // while waiting for downstream capacity. Encoding happens at enqueue time
  // (drainPending) so the bytes live only inside the controller's internal
  // queue, not in two places.
  //
  // Uses an index pointer instead of Array.prototype.shift() (which is O(n))
  // so many small router-injected script chunks stay O(1) per chunk.
  const pendingWrites: Array<string> = []
  let pendingWriteHead = 0
  let pendingWriteChars = 0

  function clearPending() {
    pendingWrites.length = 0
    pendingWriteHead = 0
    pendingWriteChars = 0
  }

  // Backpressure: pull() resolves drainResolve to let the read loop advance.
  let drainResolve: (() => void) | null = null
  const waitForDrain = () =>
    new Promise<void>((r) => {
      drainResolve = r
    })
  const signalDrain = () => {
    if (drainResolve) {
      const r = drainResolve
      drainResolve = null
      r()
    }
  }

  const isDone = () => state === MergeState.Done

  function drainPending() {
    if (!controller || isDone()) return
    while (pendingWriteHead < pendingWrites.length) {
      const ds = controller.desiredSize
      if (ds !== null && ds <= 0) return
      const next = pendingWrites[pendingWriteHead]!
      // Release reference for GC; compact when fully drained.
      pendingWrites[pendingWriteHead] = ''
      pendingWriteHead++
      pendingWriteChars -= next.length
      try {
        controller.enqueue(textEncoder.encode(next))
      } catch (error) {
        safeError(error)
        cleanup(error)
        return
      }
    }
    // Fully drained: reset array so it doesn't grow unbounded across SSR.
    if (pendingWriteHead >= pendingWrites.length) {
      pendingWrites.length = 0
      pendingWriteHead = 0
    }
    // If we've flushed everything and tryFinish requested close, close now.
    if (closeWhenDrained && pendingWriteHead >= pendingWrites.length) {
      closeWhenDrained = false
      safeClose()
      cleanup(undefined, false)
    }
  }

  /**
   * Enqueue a string chunk through the backpressure queue. Stored as a
   * string and encoded only when the downstream actually accepts the chunk
   * — keeps native-memory pressure inside the controller's queue (which
   * honors desiredSize) rather than ours.
   */
  function writeChunk(chunk: string) {
    if (cleanedUp || isDone()) return
    if (!chunk.length) return
    if (pendingWriteChars + chunk.length > MAX_PENDING_WRITE_CHARS) {
      const err = new Error('SSR stream pending output exceeded maximum buffer')
      safeError(err)
      cleanup(err)
      return
    }
    pendingWrites.push(chunk)
    pendingWriteChars += chunk.length
    drainPending()
  }

  function safeClose() {
    if (isDone()) return
    state = MergeState.Done
    try {
      controller?.close()
    } catch {
      // ignore
    }
  }

  function safeError(error: unknown) {
    if (isDone()) return
    state = MergeState.Done
    try {
      controller?.error(error)
    } catch {
      // ignore
    }
  }

  /**
   * Cleanup with guards; must be idempotent.
   */
  function cleanup(reason?: unknown, cancelReader = true) {
    if (cleanedUp) return resolvedPromise
    cleanedUp = true

    try {
      stopListeningToInjectedHtml?.()
      stopListeningToSerializationFinished?.()
    } catch {
      // ignore
    }
    stopListeningToInjectedHtml = undefined
    stopListeningToSerializationFinished = undefined

    if (serializationTimeoutHandle !== undefined) {
      clearTimeout(serializationTimeoutHandle)
      serializationTimeoutHandle = undefined
    }
    if (lifetimeTimeoutHandle !== undefined) {
      clearTimeout(lifetimeTimeoutHandle)
      lifetimeTimeoutHandle = undefined
    }

    clearPendingRouterHtml()
    leftover = ''
    pendingTail = ''
    clearPending()

    if (cancelReader) {
      // Notify the producer immediately. Reader cancellation may take time to
      // settle, and upstream renderers must tolerate abort + cancel overlap.
      notifyAbort(reason)
    }
    const readerDone = cancelReader
      ? readerState.cancel(reason)
      : (readerState.release(), resolvedPromise)
    signalDrain()
    try {
      serverSsr.cleanup()
    } catch (error) {
      console.error('Error in SSR cleanup:', error)
    }
    return readerDone
  }

  const textDecoder = new TextDecoder()

  // Router-injected scripts/HTML waiting for the next safe body boundary.
  // Keep chunks separate so flushing does not flatten a large rope string.
  const pendingRouterHtml: Array<string> = []
  let pendingRouterHtmlChars = 0

  // between-chunk text buffer; keep bounded to avoid unbounded memory
  let leftover = ''

  // captured bytes from </body> onward; must stay behind router scripts.
  let pendingTail = ''

  let streamBarrierLifted = false
  let streamBarrierMarkerSeen = false
  let serializationFinished = false

  function noteBarrierMarker(chunk: string) {
    if (streamBarrierMarkerSeen) return
    if (chunk.includes(TSR_SCRIPT_BARRIER_ID)) {
      streamBarrierMarkerSeen = true
    }
  }

  function liftBarrierAfterBoundary() {
    if (streamBarrierLifted) return
    if (!streamBarrierMarkerSeen) return
    streamBarrierLifted = true
    serverSsr.liftScriptBarrier()
  }

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
      // If anything queued before start (shouldn't happen but be safe), drain.
      drainPending()
    },
    pull() {
      // Consumer has capacity; flush queue then unblock read loop.
      drainPending()
      signalDrain()
    },
    cancel(reason) {
      state = MergeState.Done
      return cleanup(reason)
    },
  })

  function drainRouterHtml() {
    if (cleanedUp || isDone()) return
    let html: string | undefined
    try {
      html = serverSsr.takeBufferedHtml()
    } catch (error) {
      safeError(error)
      cleanup(error)
      return
    }
    if (!html) return
    if (state >= MergeState.Draining) {
      // At this point final tail/close has already been queued. Emitting late
      // router HTML would put scripts after </body> or drop them silently.
      const err = new Error(
        'SSR router HTML injected after stream finalization',
      )
      safeError(err)
      cleanup(err)
      return
    }
    if (state === MergeState.HoldingTail) {
      flushPendingRouterHtml()
      writeChunk(html)
    } else {
      if (pendingRouterHtmlChars + html.length > MAX_ROUTER_HTML_CHARS) {
        const err = new Error('SSR router HTML exceeded maximum buffer')
        safeError(err)
        cleanup(err)
        return
      }
      pendingRouterHtml.push(html)
      pendingRouterHtmlChars += html.length
    }
  }

  function flushPendingRouterHtml() {
    if (!pendingRouterHtml.length) return
    for (const html of pendingRouterHtml) {
      writeChunk(html)
    }
    clearPendingRouterHtml()
  }

  function clearPendingRouterHtml() {
    pendingRouterHtml.length = 0
    pendingRouterHtmlChars = 0
  }

  function appendTail(chunk: string) {
    pendingTail += chunk
    if (pendingTail.length > MAX_TAIL_CHARS) {
      throw new Error('SSR stream tail exceeded maximum buffer')
    }
  }

  function waitForBackpressure() {
    return !!(
      controller &&
      controller.desiredSize !== null &&
      controller.desiredSize <= 0
    )
  }

  function startSerializationTimeout() {
    if (cleanedUp || isDone()) return
    if (serializationTimeoutHandle !== undefined) return
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_SERIALIZATION_TIMEOUT_MS
    serializationTimeoutHandle = setTimeout(() => {
      if (!cleanedUp && !isDone()) {
        const err = new Error('Serialization timeout after app render finished')
        console.error('Serialization timeout after app render finished')
        safeError(err)
        cleanup(err)
      }
    }, timeoutMs)
  }

  /**
   * Finish only when app done and serialization complete. Queues final
   * output and requests close-when-drained so we don't close ahead of
   * pending writes still waiting on downstream capacity.
   */
  function tryFinish() {
    if (state !== MergeState.AppDone || !serializationFinished) return
    if (cleanedUp || isDone()) return

    if (serializationTimeoutHandle !== undefined) {
      clearTimeout(serializationTimeoutHandle)
      serializationTimeoutHandle = undefined
    }

    drainRouterHtml()
    if (cleanedUp || isDone()) return

    // Flush any remaining bytes in the TextDecoder
    const decoderRemainder = textDecoder.decode()

    if (leftover) writeChunk(leftover)
    if (cleanedUp || isDone()) return
    if (decoderRemainder) writeChunk(decoderRemainder)
    if (cleanedUp || isDone()) return
    flushPendingRouterHtml()
    if (cleanedUp || isDone()) return
    if (pendingTail) writeChunk(pendingTail)
    if (cleanedUp || isDone()) return

    leftover = ''
    pendingTail = ''

    state = MergeState.Draining
    closeWhenDrained = true
    // Try immediately; if queue not drained yet, pull() will retry.
    drainPending()
  }

  function finishAppRendering() {
    if (state >= MergeState.AppDone) return
    state = MergeState.AppDone
    try {
      serverSsr.setRenderFinished()
    } catch (error) {
      safeError(error)
      cleanup(error)
      return
    }
    drainRouterHtml()
    if (cleanedUp || isDone()) return
    serializationFinished =
      serializationFinished || serverSsr.isSerializationFinished()
    if (serializationFinished) {
      tryFinish()
    } else {
      startSerializationTimeout()
    }
  }

  // Safety net: cleanup even if consumer never reads
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_SERIALIZATION_TIMEOUT_MS
  const lifetimeMs = opts?.lifetimeMs ?? timeoutMs * 2
  lifetimeTimeoutHandle = setTimeout(() => {
    if (!cleanedUp && !isDone()) {
      const err = new Error('Stream lifetime exceeded')
      console.warn(
        `SSR stream transform exceeded maximum lifetime (${lifetimeMs}ms), forcing cleanup`,
      )
      safeError(err)
      cleanup(err)
    }
  }, lifetimeMs)

  stopListeningToInjectedHtml = serverSsr.onInjectedHtml(() => {
    drainRouterHtml()
  })

  stopListeningToSerializationFinished = serverSsr.onSerializationFinished(
    () => {
      serializationFinished = true
      drainRouterHtml()
      tryFinish()
    },
  )

  // Subscriptions are installed before snapshots, so missed events are
  // recovered by these synchronous drains/rechecks.
  drainRouterHtml()
  if (cleanedUp || isDone()) return stream
  serializationFinished =
    serializationFinished || serverSsr.isSerializationFinished()
  if (serializationFinished) {
    drainRouterHtml()
    if (cleanedUp || isDone()) return stream
  }

  // Transform the appStream
  ;(async () => {
    try {
      while (true) {
        // Backpressure: pause upstream reads while downstream is full.
        if (waitForBackpressure()) {
          await waitForDrain()
          if (cleanedUp || isDone()) return
        }

        const { done, value } = await readerState.reader.read()
        if (done) break

        if (cleanedUp || isDone()) return

        const text =
          typeof value === 'string'
            ? value
            : textDecoder.decode(value as ArrayBufferView, { stream: true })

        const chunkString = leftover ? leftover + text : text

        // If we already saw </body>, everything else is tail. Keep it bounded
        // and held until router scripts are ready so injection remains before </body>.
        if (state >= MergeState.HoldingTail) {
          appendTail(chunkString)
          leftover = ''
          continue
        }

        const boundary = findHtmlBoundary(chunkString)
        if (boundary < -1) {
          const bodyEndIndex = -boundary - 2
          state = MergeState.HoldingTail
          appendTail(chunkString.slice(bodyEndIndex))
          const bodyChunk = chunkString.slice(0, bodyEndIndex)
          writeChunk(bodyChunk)
          if (cleanedUp || isDone()) return
          noteBarrierMarker(bodyChunk)
          liftBarrierAfterBoundary()
          if (cleanedUp || isDone()) return
          flushPendingRouterHtml()
          leftover = ''
          continue
        }

        const lastClosingTagEnd = boundary

        if (lastClosingTagEnd > 0) {
          const safeChunk = chunkString.slice(0, lastClosingTagEnd)
          writeChunk(safeChunk)
          if (cleanedUp || isDone()) return
          noteBarrierMarker(safeChunk)
          liftBarrierAfterBoundary()
          if (cleanedUp || isDone()) return
          flushPendingRouterHtml()

          leftover = chunkString.slice(lastClosingTagEnd)
          if (leftover.length > MAX_LEFTOVER_CHARS) {
            // Ensure bounded memory even if a consumer streams long text sequences
            // without any closing tags. This may reduce injection granularity but is correct.
            noteBarrierMarker(leftover)
            const flushed = leftover.slice(
              0,
              leftover.length - MAX_LEFTOVER_CHARS,
            )
            writeChunk(flushed)
            leftover = leftover.slice(-MAX_LEFTOVER_CHARS)
          }
        } else {
          // No closing tag found; keep small tail to handle split closing tags,
          // but stream older bytes to prevent unbounded buffering.
          const combined = chunkString
          if (combined.length > MAX_LEFTOVER_CHARS) {
            noteBarrierMarker(combined)
            const flushUpto = combined.length - MAX_LEFTOVER_CHARS
            const flushed = combined.slice(0, flushUpto)
            writeChunk(flushed)
            leftover = combined.slice(flushUpto)
          } else {
            leftover = combined
          }
        }
      }

      if (cleanedUp || isDone()) return

      finishAppRendering()
    } catch (error) {
      if (cleanedUp) return
      console.error('Error reading appStream:', error)
      if (state < MergeState.AppDone) {
        try {
          serverSsr.setRenderFinished()
        } catch {
          // ignore
        }
      }
      safeError(error)
      cleanup(error)
    } finally {
      readerState.release()
    }
  })().catch((error) => {
    if (cleanedUp) return
    console.error('Error in stream transform:', error)
    safeError(error)
    cleanup(error)
  })

  return stream
}
