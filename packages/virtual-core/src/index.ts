import { createLazyMeasurementsView } from './lazy-measurements'
import { approxEqual, debounce, memo, notUndefined } from './utils'

// Browser-aware iOS detection. Programmatic `scrollTo`/`scrollTop` writes
// during a momentum-scroll cancel the momentum on iOS WebKit, so we defer
// scroll-position adjustments triggered by mid-scroll resizes until the
// scroll settles. SSR-safe (returns false when navigator is unavailable).
let _isIOSResult: boolean | undefined
const isIOSWebKit = (): boolean => {
  if (_isIOSResult !== undefined) return _isIOSResult
  if (typeof navigator === 'undefined') return (_isIOSResult = false)
  if (/iP(hone|od|ad)/.test(navigator.userAgent)) return (_isIOSResult = true)
  // iPadOS 13+ reports as MacIntel; touch-points distinguishes it from desktop.
  const mtp = (navigator as Navigator & { maxTouchPoints?: number })
    .maxTouchPoints
  return (_isIOSResult =
    navigator.platform === 'MacIntel' && mtp !== undefined && mtp > 0)
}

// Test hook: reset the iOS detection cache. Not exported.
export const _resetIOSDetectionForTests = () => {
  _isIOSResult = undefined
}

export { approxEqual, debounce, memo, notUndefined } from './utils'
export type { NoInfer, PartialKeys } from './utils'

//

type ScrollDirection = 'forward' | 'backward'

type ScrollAlignment = 'start' | 'center' | 'end' | 'auto'

type ScrollBehavior = 'auto' | 'smooth' | 'instant'

type ScrollAnchor = 'start' | 'end'

type FollowOnAppend = boolean | ScrollBehavior

export interface ScrollToOptions {
  align?: ScrollAlignment
  behavior?: ScrollBehavior
}

type ScrollToOffsetOptions = ScrollToOptions

type ScrollToIndexOptions = ScrollToOptions

type ScrollToEndOptions = Pick<ScrollToOptions, 'behavior'>

export interface Range {
  startIndex: number
  endIndex: number
  overscan: number
  count: number
}

type Key = number | string | bigint

export interface VirtualItem {
  key: Key
  index: number
  start: number
  end: number
  size: number
  lane: number
}

export interface Rect {
  width: number
  height: number
}

//

const getRect = (element: HTMLElement): Rect => {
  const { offsetWidth, offsetHeight } = element
  return { width: offsetWidth, height: offsetHeight }
}

export const defaultKeyExtractor = (index: number) => index

export const defaultRangeExtractor = (range: Range) => {
  const start = Math.max(range.startIndex - range.overscan, 0)
  const end = Math.min(range.endIndex + range.overscan, range.count - 1)
  const len = end - start + 1

  const arr = new Array<number>(len)
  for (let i = 0; i < len; i++) {
    arr[i] = start + i
  }
  return arr
}

export const observeElementRect = <T extends Element>(
  instance: Virtualizer<T, any>,
  cb: (rect: Rect) => void,
) => {
  const element = instance.scrollElement
  if (!element) {
    return
  }
  const targetWindow = instance.targetWindow
  if (!targetWindow) {
    return
  }

  const handler = (rect: Rect) => {
    const { width, height } = rect
    cb({ width: Math.round(width), height: Math.round(height) })
  }

  handler(getRect(element as unknown as HTMLElement))

  if (!targetWindow.ResizeObserver) {
    return () => {}
  }

  const observer = new targetWindow.ResizeObserver((entries) => {
    const run = () => {
      const entry = entries[0]
      if (entry?.borderBoxSize) {
        const box = entry.borderBoxSize[0]
        if (box) {
          handler({ width: box.inlineSize, height: box.blockSize })
          return
        }
      }
      handler(getRect(element as unknown as HTMLElement))
    }

    instance.options.useAnimationFrameWithResizeObserver
      ? requestAnimationFrame(run)
      : run()
  })

  observer.observe(element, { box: 'border-box' })

  return () => {
    observer.unobserve(element)
  }
}

const addEventListenerOptions = {
  passive: true,
}

export const observeWindowRect = (
  instance: Virtualizer<Window, any>,
  cb: (rect: Rect) => void,
) => {
  const element = instance.scrollElement
  if (!element) {
    return
  }

  const handler = () => {
    cb({ width: element.innerWidth, height: element.innerHeight })
  }
  handler()

  element.addEventListener('resize', handler, addEventListenerOptions)

  return () => {
    element.removeEventListener('resize', handler)
  }
}

const supportsScrollend =
  typeof window == 'undefined' ? true : 'onscrollend' in window

type ObserveOffsetCallBack = (offset: number, isScrolling: boolean) => void

// Shared core: both element and window variants attach scroll/scrollend
// listeners with the same lifecycle; they only differ in how to read the
// current offset from the scroll target.
const observeOffset = <T extends Element | Window>(
  instance: Virtualizer<T, any>,
  cb: ObserveOffsetCallBack,
  readOffset: (target: T) => number,
) => {
  const element = instance.scrollElement
  if (!element) {
    return
  }
  const targetWindow = instance.targetWindow
  if (!targetWindow) {
    return
  }

  const registerScrollendEvent =
    instance.options.useScrollendEvent && supportsScrollend

  let offset = 0
  const fallback = registerScrollendEvent
    ? null
    : debounce(
        targetWindow,
        () => cb(offset, false),
        instance.options.isScrollingResetDelay,
      )

  const createHandler = (isScrolling: boolean) => () => {
    offset = readOffset(element)
    fallback?.()
    cb(offset, isScrolling)
  }
  const handler = createHandler(true)
  const endHandler = createHandler(false)

  element.addEventListener('scroll', handler, addEventListenerOptions)
  if (registerScrollendEvent) {
    element.addEventListener('scrollend', endHandler, addEventListenerOptions)
  }
  return () => {
    element.removeEventListener('scroll', handler)
    if (registerScrollendEvent) {
      element.removeEventListener('scrollend', endHandler)
    }
  }
}

export const observeElementOffset = <T extends Element>(
  instance: Virtualizer<T, any>,
  cb: ObserveOffsetCallBack,
) =>
  observeOffset(instance, cb, (el) => {
    const { horizontal, isRtl } = instance.options
    return horizontal ? el.scrollLeft * ((isRtl && -1) || 1) : el.scrollTop
  })

export const observeWindowOffset = (
  instance: Virtualizer<Window, any>,
  cb: ObserveOffsetCallBack,
) =>
  observeOffset(instance, cb, (win) =>
    instance.options.horizontal ? win.scrollX : win.scrollY,
  )

export const measureElement = <TItemElement extends Element>(
  element: TItemElement,
  entry: ResizeObserverEntry | undefined,
  instance: Virtualizer<any, TItemElement>,
) => {
  // When useCachedMeasurements is enabled, return the cached size
  // (or estimateSize as fallback) instead of measuring the DOM.
  if (instance.options.useCachedMeasurements) {
    const index = instance.indexFromElement(element)
    const key = instance.options.getItemKey(index)
    return (
      instance.itemSizeCache.get(key) ?? instance.options.estimateSize(index)
    )
  }

  if (entry?.borderBoxSize) {
    const box = entry.borderBoxSize[0]
    if (box) {
      const size = Math.round(
        box[instance.options.horizontal ? 'inlineSize' : 'blockSize'],
      )
      return size
    }
  }

  // When called without a ResizeObserverEntry (sync measurement path),
  // return the previously measured size if available. This avoids a
  // synchronous layout read (offsetWidth/offsetHeight) on re-renders.
  // The ResizeObserver is already observing the element and will deliver
  // the accurate size asynchronously if it changed.
  // Users who need synchronous DOM reads can provide a custom measureElement.
  if (!entry) {
    const index = instance.indexFromElement(element)
    const key = instance.options.getItemKey(index)
    const cachedSize = instance.itemSizeCache.get(key)
    if (cachedSize !== undefined) {
      return cachedSize
    }
  }

  return (element as unknown as HTMLElement)[
    instance.options.horizontal ? 'offsetWidth' : 'offsetHeight'
  ]
}

const scrollWithAdjustments = (
  offset: number,
  {
    adjustments = 0,
    behavior,
  }: { adjustments?: number; behavior?: ScrollBehavior },
  instance: Virtualizer<any, any>,
) => {
  instance.scrollElement?.scrollTo?.({
    [instance.options.horizontal ? 'left' : 'top']: offset + adjustments,
    behavior,
  })
}

export const windowScroll: <T extends Window>(
  offset: number,
  options: { adjustments?: number; behavior?: ScrollBehavior },
  instance: Virtualizer<T, any>,
) => void = scrollWithAdjustments

export const elementScroll: <T extends Element>(
  offset: number,
  options: { adjustments?: number; behavior?: ScrollBehavior },
  instance: Virtualizer<T, any>,
) => void = scrollWithAdjustments

type LaneAssignmentMode = 'estimate' | 'measured'

export interface VirtualizerOptions<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> {
  // Required from the user
  count: number
  getScrollElement: () => TScrollElement | null
  estimateSize: (index: number) => number

  // Required from the framework adapter (but can be overridden)
  scrollToFn: (
    offset: number,
    options: { adjustments?: number; behavior?: ScrollBehavior },
    instance: Virtualizer<TScrollElement, TItemElement>,
  ) => void
  observeElementRect: (
    instance: Virtualizer<TScrollElement, TItemElement>,
    cb: (rect: Rect) => void,
  ) => void | (() => void)
  observeElementOffset: (
    instance: Virtualizer<TScrollElement, TItemElement>,
    cb: ObserveOffsetCallBack,
  ) => void | (() => void)
  // Optional
  debug?: boolean
  initialRect?: Rect
  onChange?: (
    instance: Virtualizer<TScrollElement, TItemElement>,
    sync: boolean,
  ) => void
  measureElement?: (
    element: TItemElement,
    entry: ResizeObserverEntry | undefined,
    instance: Virtualizer<TScrollElement, TItemElement>,
  ) => number
  overscan?: number
  horizontal?: boolean
  paddingStart?: number
  paddingEnd?: number
  scrollPaddingStart?: number
  scrollPaddingEnd?: number
  initialOffset?: number | (() => number)
  getItemKey?: (index: number) => Key
  rangeExtractor?: (range: Range) => Array<number>
  scrollMargin?: number
  gap?: number
  indexAttribute?: string
  initialMeasurementsCache?: Array<VirtualItem>
  lanes?: number
  anchorTo?: ScrollAnchor
  followOnAppend?: FollowOnAppend
  scrollEndThreshold?: number
  isScrollingResetDelay?: number
  useScrollendEvent?: boolean
  enabled?: boolean
  isRtl?: boolean
  useAnimationFrameWithResizeObserver?: boolean
  laneAssignmentMode?: LaneAssignmentMode
  useCachedMeasurements?: boolean
}

type ScrollState = {
  // what we want
  index: number | null
  align: ScrollAlignment
  behavior: ScrollBehavior

  // lifecycle
  startedAt: number

  // target tracking
  lastTargetOffset: number

  // settling
  stableFrames: number
}

type PendingScrollAnchor = [
  key: Key | null,
  offset: number,
  followOnAppend: ScrollBehavior | null,
  anchorDelta: number,
]

export class Virtualizer<
  TScrollElement extends Element | Window,
  TItemElement extends Element,
> {
  private unsubs: Array<void | (() => void)> = []
  options!: Required<VirtualizerOptions<TScrollElement, TItemElement>>
  scrollElement: TScrollElement | null = null
  targetWindow: (Window & typeof globalThis) | null = null
  isScrolling = false
  private scrollState: ScrollState | null = null
  measurementsCache: Array<VirtualItem> = []
  // Flat backing store for the lanes===1 fast path: [start_0, size_0, start_1, size_1, ...].
  // null until the first single-lane build; reused (and grown) across rebuilds.
  private _flatMeasurements: Float64Array | null = null
  itemSizeCache = new Map<Key, number>()
  private itemSizeCacheVersion = 0
  private laneAssignments = new Map<number, number>() // index → lane cache
  // Earliest index dirtied since last getMeasurements() rebuild, or null.
  private pendingMin: number | null = null
  private prevLanes: number | undefined = undefined
  private lanesChangedFlag = false
  private lanesSettling = false
  private pendingScrollAnchor: PendingScrollAnchor | null = null
  scrollRect: Rect | null = null
  scrollOffset: number | null = null
  scrollDirection: ScrollDirection | null = null
  private scrollAdjustments = 0
  // Sum of size-change deltas above-viewport that were skipped during
  // iOS momentum scroll (writing scrollTop mid-momentum cancels it).
  // Flushed in a single scrollTo when iOS is fully settled.
  private _iosDeferredAdjustment = 0
  // Touch state. iOS WebKit cancels momentum when scrollTop is written, so
  // we defer adjustments not only during `isScrolling` but also through the
  // touchstart→touchend window (active drag) and a short tail after
  // touchend (early-momentum window — iOS only fires touch events once at
  // the start of momentum, so we use a timer rather than another event).
  private _iosTouching = false
  private _iosJustTouchEnded = false
  private _iosTouchEndTimerId: number | null = null
  // Subpixel reconciliation. Safari (and Chrome/Firefox under certain DPRs)
  // round scrollTop/scrollLeft writes to integer pixels. If we wrote 12345.5
  // but the browser reports back 12346, the next reconcileScroll sees a
  // "target changed" and re-fires scrollTo — a feedback loop that the
  // approxEqual(<1.01) tolerance otherwise absorbs as a workaround.
  // By remembering the intended value of our most-recent self-driven
  // scrollTo, we can match the browser's rounded read back to the intended
  // value when the diff is < 1.5 px, distinguishing it from a real user
  // scroll. The +0.5 over Math.abs lets us also absorb the +1 / -1 cases.
  private _intendedScrollOffset: number | null = null
  shouldAdjustScrollPositionOnItemSizeChange:
    | undefined
    | ((
        item: VirtualItem,
        delta: number,
        instance: Virtualizer<TScrollElement, TItemElement>,
      ) => boolean)
  elementsCache = new Map<Key, TItemElement>()
  private now = () => this.targetWindow?.performance?.now?.() ?? Date.now()
  private observer = (() => {
    let _ro: ResizeObserver | null = null

    const get = () => {
      if (_ro) {
        return _ro
      }

      if (!this.targetWindow || !this.targetWindow.ResizeObserver) {
        return null
      }

      return (_ro = new this.targetWindow.ResizeObserver((entries) => {
        entries.forEach((entry) => {
          const run = () => {
            const node = entry.target as TItemElement
            const index = this.indexFromElement(node)

            if (!node.isConnected) {
              this.observer.unobserve(node)
              // Find the cache entry pointing to this exact node and remove
              // it. We can't call getItemKey(index) here because items may
              // have been removed since this node was rendered — the index
              // could be stale and out-of-bounds in the user's data array
              // (regression test in e2e/.../stale-index.spec.ts, fix #1148).
              // The === comparison naturally handles the React-replaced-
              // a-node-for-the-same-key case: that entry now points to a
              // different node, so this loop won't match.
              for (const [cacheKey, cachedNode] of this.elementsCache) {
                if (cachedNode === node) {
                  this.elementsCache.delete(cacheKey)
                  break
                }
              }
              return
            }

            if (this.shouldMeasureDuringScroll(index)) {
              this.resizeItem(
                index,
                this.options.measureElement(node, entry, this),
              )
            }
          }
          this.options.useAnimationFrameWithResizeObserver
            ? requestAnimationFrame(run)
            : run()
        })
      }))
    }

    return {
      disconnect: () => {
        get()?.disconnect()
        _ro = null
      },
      observe: (target: Element) =>
        get()?.observe(target, { box: 'border-box' }),
      unobserve: (target: Element) => get()?.unobserve(target),
    }
  })()
  range: { startIndex: number; endIndex: number } | null = null

  constructor(opts: VirtualizerOptions<TScrollElement, TItemElement>) {
    this.setOptions(opts)
  }

  setOptions = (opts: VirtualizerOptions<TScrollElement, TItemElement>) => {
    // Skip `{...defaults, ...opts}` because explicit `undefined` values in
    // opts would override defaults with `undefined`.
    const merged = {
      debug: false,
      initialOffset: 0,
      overscan: 1,
      paddingStart: 0,
      paddingEnd: 0,
      scrollPaddingStart: 0,
      scrollPaddingEnd: 0,
      horizontal: false,
      getItemKey: defaultKeyExtractor,
      rangeExtractor: defaultRangeExtractor,
      onChange: () => {},
      measureElement,
      initialRect: { width: 0, height: 0 },
      scrollMargin: 0,
      gap: 0,
      indexAttribute: 'data-index',
      initialMeasurementsCache: [],
      lanes: 1,
      anchorTo: 'start',
      followOnAppend: false,
      scrollEndThreshold: 1,
      isScrollingResetDelay: 150,
      enabled: true,
      isRtl: false,
      useScrollendEvent: false,
      useAnimationFrameWithResizeObserver: false,
      laneAssignmentMode: 'estimate',
      useCachedMeasurements: false,
    } as unknown as Required<VirtualizerOptions<TScrollElement, TItemElement>>

    for (const key in opts) {
      const v = (opts as any)[key]
      if (v !== undefined) (merged as any)[key] = v
    }

    const prevOptions = this.options as
      | Required<VirtualizerOptions<TScrollElement, TItemElement>>
      | undefined
    let anchor: [Key, number] | null = null
    let followOnAppend: ScrollBehavior | null = null
    let edgeKeysChanged = false

    if (
      prevOptions !== undefined &&
      prevOptions.enabled &&
      merged.enabled &&
      merged.anchorTo === 'end' &&
      this.scrollElement !== null
    ) {
      const prevCount = prevOptions.count
      const nextCount = merged.count
      const measurements = this.getMeasurements()
      const prevFirstKey =
        prevCount > 0
          ? (measurements[0]?.key ?? prevOptions.getItemKey(0))
          : null
      const prevLastKey =
        prevCount > 0
          ? (measurements[prevCount - 1]?.key ??
            prevOptions.getItemKey(prevCount - 1))
          : null
      const didCountChange = nextCount !== prevCount
      const didEdgeKeysChange =
        didCountChange ||
        (prevCount > 0 &&
          nextCount > 0 &&
          (merged.getItemKey(0) !== prevFirstKey ||
            merged.getItemKey(nextCount - 1) !== prevLastKey))

      if (didEdgeKeysChange) {
        edgeKeysChanged = true
        const item =
          prevCount > 0
            ? (this.getVirtualItemForOffset(this.getScrollOffset()) ??
              measurements[0])
            : null

        if (item) {
          anchor = [item.key, this.getScrollOffset() - item.start]
        }

        const behavior =
          merged.followOnAppend === true
            ? 'auto'
            : merged.followOnAppend || null

        if (
          behavior &&
          nextCount > prevCount &&
          this.isAtEnd(prevOptions.scrollEndThreshold) &&
          (prevCount === 0 || merged.getItemKey(nextCount - 1) !== prevLastKey)
        ) {
          followOnAppend = behavior
        }
      }
    }

    this.options = merged

    // When edge keys changed (prepend, trim, reorder, etc.) the key→index
    // mapping has shifted. Force a full measurement rebuild so the anchor
    // resolution below reads positions from the new layout, not the stale
    // memoised cache. Without this, a stable `getItemKey` reference +
    // unchanged `count` would let getMeasurements() return the old layout.
    if (edgeKeysChanged) {
      this.pendingMin = 0
      this.itemSizeCacheVersion++
    }

    // Eagerly adjust scrollOffset so the virtualizer computes the correct
    // visible range during the current render pass — before _willUpdate
    // syncs the DOM scroll position in a layout effect. Without this,
    // the virtualizer would render the wrong items for one frame (the
    // estimate-based positions are stale) and then correct in the next
    // frame, producing a visible "jump" on prepend with dynamic sizes.
    let anchorResolved = false
    let anchorDelta = 0
    if (anchor && this.scrollOffset !== null) {
      const [anchorKey, anchorOffset] = anchor
      const newMeasurements = this.getMeasurements()
      const { count, getItemKey } = this.options
      let idx = 0
      while (idx < count && getItemKey(idx) !== anchorKey) {
        idx++
      }
      if (idx < count) {
        const anchorItem = newMeasurements[idx]
        if (anchorItem) {
          const newOffset = anchorItem.start + anchorOffset
          if (newOffset !== this.scrollOffset) {
            anchorDelta = newOffset - this.scrollOffset
            this.scrollOffset = newOffset
            anchorResolved = true
          }
        }
      }
    }

    if (anchorResolved || followOnAppend) {
      this.pendingScrollAnchor = [
        anchorResolved ? anchor![0] : null,
        anchorResolved ? anchor![1] : 0,
        followOnAppend,
        anchorDelta,
      ]
    }
  }

  private notify = (sync: boolean) => {
    this.options.onChange?.(this, sync)
  }

  private applyScrollAdjustment(delta: number, behavior?: ScrollBehavior) {
    if (delta === 0) return

    if (process.env.NODE_ENV !== 'production' && this.options.debug) {
      console.info('correction', delta)
    }

    if (
      isIOSWebKit() &&
      (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)
    ) {
      this._iosDeferredAdjustment += delta
    } else {
      this._scrollToOffset(this.getScrollOffset(), {
        adjustments: (this.scrollAdjustments += delta),
        behavior,
      })
      // Eagerly carry the intended target in `scrollOffset` so callers that
      // read it before the next scroll event — notably the next `resizeItem`
      // tick's `getVirtualDistanceFromEnd()` / `wasAtEnd` check — see the
      // post-adjustment position even when the DOM `scrollTop` write was
      // clamped because the consumer hasn't grown the sizer yet (`notify()`
      // runs after this in `resizeItem`). Same idea as the eager
      // `scrollOffset` adjustment for prepend in `setOptions` (#1176). The
      // adjustment is now baked into `scrollOffset`, so zero
      // `scrollAdjustments` to keep their sum invariant.
      if (this.scrollOffset !== null) {
        this.scrollOffset += this.scrollAdjustments
        this.scrollAdjustments = 0
      }
    }
  }

  private maybeNotify = memo(
    () => {
      this.calculateRange()

      return [
        this.isScrolling,
        this.range ? this.range.startIndex : null,
        this.range ? this.range.endIndex : null,
      ]
    },
    (isScrolling) => {
      this.notify(isScrolling)
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'maybeNotify',
      debug: () => this.options.debug,
      initialDeps: [
        this.isScrolling,
        this.range ? this.range.startIndex : null,
        this.range ? this.range.endIndex : null,
      ] as [boolean, number | null, number | null],
    },
  )

  private cleanup = () => {
    this.unsubs.filter(Boolean).forEach((d) => d!())
    this.unsubs = []
    this.observer.disconnect()
    if (this.rafId != null && this.targetWindow) {
      this.targetWindow.cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.scrollState = null
    this.scrollElement = null
    this.targetWindow = null
  }

  _didMount = () => {
    return () => {
      this.cleanup()
    }
  }

  _willUpdate = () => {
    const scrollElement = this.options.enabled
      ? this.options.getScrollElement()
      : null

    if (this.scrollElement !== scrollElement) {
      this.cleanup()

      if (!scrollElement) {
        this.maybeNotify()
        return
      }

      this.scrollElement = scrollElement

      if (this.scrollElement && 'ownerDocument' in this.scrollElement) {
        this.targetWindow = this.scrollElement.ownerDocument.defaultView
      } else {
        this.targetWindow = this.scrollElement?.window ?? null
      }

      this.elementsCache.forEach((cached) => {
        this.observer.observe(cached)
      })

      this.unsubs.push(
        this.options.observeElementRect(this, (rect) => {
          this.scrollRect = rect
          this.maybeNotify()
        }),
      )

      this.unsubs.push(
        this.options.observeElementOffset(this, (offset, isScrolling) => {
          // A scroll event that reports movement but lands on the offset we
          // already hold — and isn't a self-write read-back — is a spurious
          // no-op re-emit that Safari/Firefox fire after a re-render's layout
          // (Chrome doesn't). Treating it as scrolling re-arms `isScrolling`,
          // which forces a render that triggers another such event: an
          // infinite re-render loop. Ignore it. (Self-writes are handled by
          // the `_intendedScrollOffset` reconciliation just below.)
          if (
            isScrolling &&
            this._intendedScrollOffset === null &&
            offset === this.scrollOffset
          ) {
            return
          }

          // If this scroll event looks like the browser's read-back of a
          // value we just wrote, prefer our intended (sub-pixel-accurate)
          // value over the browser's rounded one. The 1.5 px tolerance is
          // tight enough to avoid mistaking a real user scroll for a
          // self-write — by the time the user has moved 1.5 px, the
          // intended value will already have been consumed by a prior
          // scroll event and cleared.
          if (
            this._intendedScrollOffset !== null &&
            Math.abs(offset - this._intendedScrollOffset) < 1.5
          ) {
            offset = this._intendedScrollOffset
          }
          this._intendedScrollOffset = null

          this.scrollAdjustments = 0
          // If the offset hasn't moved, this is the echo of our own
          // adjustment write — `applyScrollAdjustment` already folded it
          // into `scrollOffset`. There's no direction to infer, so leave
          // it alone; a real gesture always moves the offset.
          const prevOffset = this.getScrollOffset()
          this.scrollDirection = isScrolling
            ? prevOffset === offset
              ? this.scrollDirection
              : prevOffset < offset
                ? 'forward'
                : 'backward'
            : null
          this.scrollOffset = offset
          this.isScrolling = isScrolling

          // Flush deferred iOS adjustments if we're now fully settled.
          // "Fully settled" means: not actively scrolling, no finger on
          // screen, and the post-touchend grace window has expired.
          this._flushIosDeferredIfReady()

          if (this.scrollState) {
            this.scheduleScrollReconcile()
          }
          this.maybeNotify()
        }),
      )

      // Touch event listeners (iOS-aware deferral). We attach unconditionally
      // — the listeners are passive and cheap; on non-touch devices they
      // simply never fire. The gating by isIOSWebKit() lives in resizeItem
      // and _flushIosDeferredIfReady so we only burn the path on iOS.
      if ('addEventListener' in this.scrollElement) {
        const scrollEl = this.scrollElement as unknown as EventTarget
        const onTouchStart = () => {
          this._iosTouching = true
          this._iosJustTouchEnded = false
          if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
            this.targetWindow.clearTimeout(this._iosTouchEndTimerId)
            this._iosTouchEndTimerId = null
          }
        }
        const onTouchEnd = () => {
          this._iosTouching = false
          if (!isIOSWebKit() || this.targetWindow == null) {
            // Non-iOS: nothing more to track. Just clear the touching flag.
            return
          }
          this._iosJustTouchEnded = true
          // After ~150 ms with no scroll/touch events, momentum is done.
          this._iosTouchEndTimerId = this.targetWindow.setTimeout(() => {
            this._iosJustTouchEnded = false
            this._iosTouchEndTimerId = null
            // After the grace window, attempt to flush. The scroll event
            // for momentum decay may have already fired before our timer.
            this._flushIosDeferredIfReady()
          }, 150)
        }
        scrollEl.addEventListener(
          'touchstart',
          onTouchStart,
          addEventListenerOptions,
        )
        scrollEl.addEventListener(
          'touchend',
          onTouchEnd,
          addEventListenerOptions,
        )
        this.unsubs.push(() => {
          scrollEl.removeEventListener('touchstart', onTouchStart)
          scrollEl.removeEventListener('touchend', onTouchEnd)
          if (this._iosTouchEndTimerId !== null && this.targetWindow != null) {
            this.targetWindow.clearTimeout(this._iosTouchEndTimerId)
            this._iosTouchEndTimerId = null
          }
        })
      }

      this._scrollToOffset(this.getScrollOffset(), {
        adjustments: undefined,
        behavior: undefined,
      })
    }

    const anchor = this.pendingScrollAnchor
    this.pendingScrollAnchor = null

    if (anchor && this.scrollElement && this.options.enabled) {
      const [key, _offset, followOnAppend, anchorDelta] = anchor

      if (key !== null && !followOnAppend) {
        // scrollOffset was eagerly adjusted in setOptions so the
        // virtualizer already computed the correct range during render.
        // Now sync the browser's actual scroll position to match.
        // Skip when followOnAppend is set — scrollToEnd will handle it.
        //
        // On iOS WebKit, writing scrollTop during touch/momentum cancels
        // the in-flight scroll. Defer the DOM sync the same way
        // applyScrollAdjustment does — accumulate the delta and let
        // _flushIosDeferredIfReady handle it once the scroll settles.
        if (
          isIOSWebKit() &&
          (this.isScrolling || this._iosTouching || this._iosJustTouchEnded)
        ) {
          if (anchorDelta !== 0) {
            this._iosDeferredAdjustment += anchorDelta
          }
        } else {
          this._scrollToOffset(this.getScrollOffset(), {
            adjustments: undefined,
            behavior: undefined,
          })
        }
      }

      if (followOnAppend) {
        this.scrollToEnd({ behavior: followOnAppend })
      }
    }
  }

  // Apply any accumulated iOS-deferred scroll adjustment, but only when we're
  // truly settled — not actively scrolling, not under an active touch, and
  // past the post-touchend grace window. Called from the scroll callback
  // and the touchend grace-timer.
  private _flushIosDeferredIfReady = () => {
    if (this._iosDeferredAdjustment === 0) return
    if (this.isScrolling) return
    if (this._iosTouching) return
    if (this._iosJustTouchEnded) return
    // Phase 2b: Safari elastic-overscroll (rubber-band) lets scrollTop go
    // negative or beyond scrollHeight - clientHeight. Writing scrollTop
    // while in that zone snaps the page back to the clamped value at the
    // end of the bounce, often discarding the user's intent. Skip the
    // flush; the next in-bounds scroll event will retry.
    const cur = this.getScrollOffset()
    const max = this.getMaxScrollOffset()
    if (cur < 0 || cur > max) return
    const delta = this._iosDeferredAdjustment
    this._iosDeferredAdjustment = 0
    // Roll the deferred delta into the running accumulator so any resize
    // landing between now and the resulting scroll event computes from the
    // post-flush offset rather than the stale one.
    this._scrollToOffset(cur, {
      adjustments: (this.scrollAdjustments += delta),
      behavior: undefined,
    })
  }

  private rafId: number | null = null
  private scheduleScrollReconcile() {
    if (!this.targetWindow) {
      this.scrollState = null
      return
    }
    if (this.rafId != null) return
    this.rafId = this.targetWindow.requestAnimationFrame(() => {
      this.rafId = null
      this.reconcileScroll()
    })
  }
  private reconcileScroll() {
    if (!this.scrollState) return

    const el = this.scrollElement
    if (!el) return

    // Safety valve: bail out if reconciliation has been running too long
    const MAX_RECONCILE_MS = 5000
    if (this.now() - this.scrollState.startedAt > MAX_RECONCILE_MS) {
      this.scrollState = null
      return
    }

    const offsetInfo =
      this.scrollState.index != null
        ? this.getOffsetForIndex(this.scrollState.index, this.scrollState.align)
        : undefined
    const targetOffset = offsetInfo
      ? offsetInfo[0]
      : this.scrollState.lastTargetOffset

    // Require one stable frame where target matches scroll offset.
    // approxEqual() already tolerates minor fluctuations, so one frame is sufficient
    // to confirm scroll has reached its target without premature cleanup.
    const STABLE_FRAMES = 1

    const targetChanged = targetOffset !== this.scrollState.lastTargetOffset

    if (!targetChanged && approxEqual(targetOffset, this.getScrollOffset())) {
      this.scrollState.stableFrames++
      if (this.scrollState.stableFrames >= STABLE_FRAMES) {
        // Final-pass exact landing. The reconcile-stable check uses a 1.01px
        // tolerance (approxEqual) so we don't fight subpixel browser rounding
        // during the converging phase. Once we're definitively settled,
        // commit the exact target so consumers calling scrollToIndex(N)
        // end up at the EXACT computed position of item N — matching
        // virtuoso's 0px landing accuracy rather than our prior 0.5-1px.
        if (this.getScrollOffset() !== targetOffset) {
          this._scrollToOffset(targetOffset, {
            adjustments: undefined,
            behavior: 'auto',
          })
        }
        this.scrollState = null
        return
      }
    } else {
      this.scrollState.stableFrames = 0

      if (targetChanged) {
        // When the target moves during smooth scroll (because items came into
        // view and got measured, shifting positions), the original logic was
        // to immediately snap to 'auto' — visibly jarring on long
        // scroll-to-index calls. Now: keep smooth while we're still far
        // (more than a viewport) from the new target. Only fall back to
        // 'auto' for the final approach, so the user sees one continuous
        // motion that smoothly adjusts its endpoint as measurements arrive.
        const viewport = this.getSize() || 600
        const distance = Math.abs(targetOffset - this.getScrollOffset())
        const keepSmooth =
          this.scrollState.behavior === 'smooth' && distance > viewport

        this.scrollState.lastTargetOffset = targetOffset
        if (!keepSmooth) {
          this.scrollState.behavior = 'auto'
        }

        this._scrollToOffset(targetOffset, {
          adjustments: undefined,
          behavior: keepSmooth ? 'smooth' : 'auto',
        })
      }
    }

    // Always reschedule while scrollState is active to guarantee
    // the safety valve timeout runs even if no scroll events fire
    // (e.g. no-op scrollToFn, detached element)
    this.scheduleScrollReconcile()
  }

  private getSize = () => {
    if (!this.options.enabled) {
      this.scrollRect = null
      return 0
    }

    this.scrollRect = this.scrollRect ?? this.options.initialRect

    return this.scrollRect[this.options.horizontal ? 'width' : 'height']
  }

  private getScrollOffset = () => {
    if (!this.options.enabled) {
      this.scrollOffset = null
      return 0
    }

    this.scrollOffset =
      this.scrollOffset ??
      (typeof this.options.initialOffset === 'function'
        ? this.options.initialOffset()
        : this.options.initialOffset)

    return this.scrollOffset
  }

  private getFurthestMeasurement = (
    measurements: Array<VirtualItem>,
    index: number,
  ) => {
    const furthestMeasurementsFound = new Map<number, true>()
    const furthestMeasurements = new Map<number, VirtualItem>()
    for (let m = index - 1; m >= 0; m--) {
      const measurement = measurements[m]!

      if (furthestMeasurementsFound.has(measurement.lane)) {
        continue
      }

      const previousFurthestMeasurement = furthestMeasurements.get(
        measurement.lane,
      )
      if (
        previousFurthestMeasurement == null ||
        measurement.end > previousFurthestMeasurement.end
      ) {
        furthestMeasurements.set(measurement.lane, measurement)
      } else if (measurement.end < previousFurthestMeasurement.end) {
        furthestMeasurementsFound.set(measurement.lane, true)
      }

      if (furthestMeasurementsFound.size === this.options.lanes) {
        break
      }
    }

    return furthestMeasurements.size === this.options.lanes
      ? Array.from(furthestMeasurements.values()).sort((a, b) => {
          if (a.end === b.end) {
            return a.index - b.index
          }

          return a.end - b.end
        })[0]
      : undefined
  }

  private getMeasurementOptions = memo(
    () => [
      this.options.count,
      this.options.paddingStart,
      this.options.scrollMargin,
      this.options.getItemKey,
      this.options.enabled,
      this.options.lanes,
      this.options.laneAssignmentMode,
    ],
    (
      count,
      paddingStart,
      scrollMargin,
      getItemKey,
      enabled,
      lanes,
      laneAssignmentMode,
    ) => {
      const lanesChanged =
        this.prevLanes !== undefined && this.prevLanes !== lanes

      if (lanesChanged) {
        // Set flag for getMeasurements to handle
        this.lanesChangedFlag = true
      }

      this.prevLanes = lanes
      this.pendingMin = null

      return {
        count,
        paddingStart,
        scrollMargin,
        getItemKey,
        enabled,
        lanes,
        laneAssignmentMode,
      }
    },
    {
      key: false,
    },
  )

  private getMeasurements = memo(
    () => [this.getMeasurementOptions(), this.itemSizeCacheVersion],
    (
      {
        count,
        paddingStart,
        scrollMargin,
        getItemKey,
        enabled,
        lanes,
        laneAssignmentMode,
      },
      _itemSizeCacheVersion,
    ) => {
      const itemSizeCache = this.itemSizeCache
      if (!enabled) {
        this.measurementsCache = []
        this.itemSizeCache.clear()
        this.laneAssignments.clear()
        return []
      }

      // Clean up stale lane cache entries when count decreases
      if (this.laneAssignments.size > count) {
        for (const index of this.laneAssignments.keys()) {
          if (index >= count) {
            this.laneAssignments.delete(index)
          }
        }
      }

      // ✅ Force complete recalculation when lanes change
      if (this.lanesChangedFlag) {
        this.lanesChangedFlag = false // Reset immediately
        this.lanesSettling = true // Start settling period
        this.measurementsCache = []
        this.itemSizeCache.clear()
        this.laneAssignments.clear() // Clear lane cache for new lane count
        // Force min = 0 on the rebuild
        this.pendingMin = null
      }

      // Don't restore from initialMeasurementsCache during lane changes
      // as it contains stale lane assignments from the previous lane count
      if (this.measurementsCache.length === 0 && !this.lanesSettling) {
        this.measurementsCache = this.options.initialMeasurementsCache
        this.measurementsCache.forEach((item) => {
          this.itemSizeCache.set(item.key, item.size)
        })
      }

      // During lanes settling, ignore pendingMin to prevent repositioning
      const min = this.lanesSettling ? 0 : (this.pendingMin ?? 0)
      this.pendingMin = null

      // ✅ End settling period when cache is fully built
      if (this.lanesSettling && this.measurementsCache.length === count) {
        this.lanesSettling = false
      }

      // ─── Fast path: single-lane lazy materialization ────────────────────
      // For lanes === 1 (the default and most common case), skip the
      // per-item VirtualItem object allocation. We write start/size pairs
      // into a Float64Array and return a Proxy that builds VirtualItem
      // objects on demand (only the indices a consumer actually reads).
      //
      // At n=100k this drops cold-mount cost from ~2.5ms (eager object
      // allocation) to roughly the cost of a single typed-array fill.
      if (lanes === 1) {
        const gap = this.options.gap
        // Reuse flat backing if large enough; else grow (preserving data
        // before `min` to mirror the slice-and-rebuild contract).
        const need = count * 2
        let flat = this._flatMeasurements
        if (!flat || flat.length < need) {
          const next = new Float64Array(need)
          if (flat && min > 0) next.set(flat.subarray(0, min * 2))
          flat = next
          this._flatMeasurements = flat
        }

        let runningStart: number
        if (min === 0) {
          runningStart = paddingStart + scrollMargin
        } else {
          // Continue from where we left off
          const prevIdx = min - 1
          runningStart = flat[prevIdx * 2]! + flat[prevIdx * 2 + 1]! + gap
        }

        for (let i = min; i < count; i++) {
          const key = getItemKey(i)
          const measuredSize = itemSizeCache.get(key)
          const size =
            typeof measuredSize === 'number'
              ? measuredSize
              : this.options.estimateSize(i)
          flat[i * 2] = runningStart
          flat[i * 2 + 1] = size
          runningStart += size + gap
        }

        const view = createLazyMeasurementsView(count, flat, getItemKey)
        this.measurementsCache = view
        return view
      }

      const measurements = this.measurementsCache.slice(0, min)

      // ✅ Performance: Track last item index per lane for O(1) lookup
      const laneLastIndex: Array<number | undefined> = new Array(lanes).fill(
        undefined,
      )

      // Initialize from existing measurements (before min)
      for (let m = 0; m < min; m++) {
        const item = measurements[m]
        if (item) {
          laneLastIndex[item.lane] = m
        }
      }

      for (let i = min; i < count; i++) {
        const key = getItemKey(i)

        // Check for cached lane assignment
        const cachedLane = this.laneAssignments.get(i)
        let lane: number
        let start: number

        const shouldCacheLane =
          laneAssignmentMode === 'estimate' || itemSizeCache.has(key)

        if (cachedLane !== undefined && this.options.lanes > 1) {
          // Use cached lane - O(1) lookup for previous item in same lane
          lane = cachedLane
          const prevIndex = laneLastIndex[lane]
          const prevInLane =
            prevIndex !== undefined ? measurements[prevIndex] : undefined
          start = prevInLane
            ? prevInLane.end + this.options.gap
            : paddingStart + scrollMargin
        } else {
          // No cache - use original logic (find shortest lane)
          const furthestMeasurement =
            this.options.lanes === 1
              ? measurements[i - 1]
              : this.getFurthestMeasurement(measurements, i)

          start = furthestMeasurement
            ? furthestMeasurement.end + this.options.gap
            : paddingStart + scrollMargin

          lane = furthestMeasurement
            ? furthestMeasurement.lane
            : i % this.options.lanes

          if (this.options.lanes > 1 && shouldCacheLane) {
            this.laneAssignments.set(i, lane)
          }
        }

        const measuredSize = itemSizeCache.get(key)
        const size =
          typeof measuredSize === 'number'
            ? measuredSize
            : this.options.estimateSize(i)

        const end = start + size

        measurements[i] = {
          index: i,
          start,
          size,
          end,
          key,
          lane,
        }

        // ✅ Performance: Update lane's last item index
        laneLastIndex[lane] = i
      }

      this.measurementsCache = measurements

      return measurements
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'getMeasurements',
      debug: () => this.options.debug,
    },
  )

  calculateRange = memo(
    () => [
      this.getMeasurements(),
      this.getSize(),
      this.getScrollOffset(),
      this.options.lanes,
    ],
    (measurements, outerSize, scrollOffset, lanes) => {
      if (measurements.length === 0 || outerSize === 0) {
        this.range = null
        return null
      }
      this.range = calculateRangeImpl(
        measurements,
        outerSize,
        scrollOffset,
        lanes,
        // Pass the typed array so binary search + forward-walk can read
        // start/end directly from Float64Array, skipping the Proxy traps.
        lanes === 1 && this._flatMeasurements != null
          ? this._flatMeasurements
          : null,
      )
      return this.range
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'calculateRange',
      debug: () => this.options.debug,
    },
  )

  getVirtualIndexes = memo(
    () => {
      let startIndex: number | null = null
      let endIndex: number | null = null
      const range = this.calculateRange()
      if (range) {
        startIndex = range.startIndex
        endIndex = range.endIndex
      }
      this.maybeNotify.updateDeps([this.isScrolling, startIndex, endIndex])
      return [
        this.options.rangeExtractor,
        this.options.overscan,
        this.options.count,
        startIndex,
        endIndex,
      ]
    },
    (rangeExtractor, overscan, count, startIndex, endIndex) => {
      return startIndex === null || endIndex === null
        ? []
        : rangeExtractor({
            startIndex,
            endIndex,
            overscan,
            count,
          })
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'getVirtualIndexes',
      debug: () => this.options.debug,
    },
  )

  indexFromElement = (node: TItemElement) => {
    const attributeName = this.options.indexAttribute
    const indexStr = node.getAttribute(attributeName)

    if (!indexStr) {
      console.warn(
        `Missing attribute name '${attributeName}={index}' on measured element.`,
      )
      return -1
    }

    return parseInt(indexStr, 10)
  }

  /**
   * Determines if an item at the given index should be measured during smooth scroll.
   * During smooth scroll, only items within a buffer range around the target are measured
   * to prevent items far from the target from pushing it away.
   */
  private shouldMeasureDuringScroll = (index: number): boolean => {
    // No scroll state or not smooth scroll - always allow measurements
    if (!this.scrollState || this.scrollState.behavior !== 'smooth') {
      return true
    }

    const scrollIndex =
      this.scrollState.index ??
      this.getVirtualItemForOffset(this.scrollState.lastTargetOffset)?.index

    if (scrollIndex !== undefined && this.range) {
      // Allow measurements within a buffer range around the scroll target
      const bufferSize = Math.max(
        this.options.overscan,
        Math.ceil((this.range.endIndex - this.range.startIndex) / 2),
      )
      const minIndex = Math.max(0, scrollIndex - bufferSize)
      const maxIndex = Math.min(
        this.options.count - 1,
        scrollIndex + bufferSize,
      )
      return index >= minIndex && index <= maxIndex
    }

    return true
  }

  measureElement = (node: TItemElement | null) => {
    if (!node) {
      this.elementsCache.forEach((cached, key) => {
        if (!cached.isConnected) {
          this.observer.unobserve(cached)
          this.elementsCache.delete(key)
        }
      })
      return
    }

    const index = this.indexFromElement(node)
    const key = this.options.getItemKey(index)
    const prevNode = this.elementsCache.get(key)

    if (prevNode !== node) {
      if (prevNode) {
        this.observer.unobserve(prevNode)
      }
      this.observer.observe(node)
      this.elementsCache.set(key, node)
    }

    // Sync-measure when idle (initial render) or during programmatic scrolling
    // (scrollToIndex/scrollToOffset) where reconcileScroll needs sizes in the same frame.
    // During normal user scrolling, skip sync measurement — the RO callback handles it async.
    if (
      (!this.isScrolling || this.scrollState) &&
      this.shouldMeasureDuringScroll(index)
    ) {
      this.resizeItem(index, this.options.measureElement(node, undefined, this))
    }
  }

  resizeItem = (index: number, size: number) => {
    if (index < 0 || index >= this.options.count) return

    // Fast field reads. For lanes===1 we read raw start/size from the flat
    // typed array, avoiding a Proxy.get + VirtualItem allocation per call.
    // For lanes>1 we fall back to the cached VirtualItem array.
    let cachedSize: number
    let itemStart: number
    let key: Key
    const flat = this._flatMeasurements
    if (this.options.lanes === 1 && flat !== null) {
      key = this.options.getItemKey(index)
      itemStart = flat[index * 2]!
      cachedSize = flat[index * 2 + 1]!
    } else {
      const item = this.measurementsCache[index]
      if (!item) return
      key = item.key
      itemStart = item.start
      cachedSize = item.size
    }

    const itemSize = this.itemSizeCache.get(key) ?? cachedSize
    const delta = size - itemSize

    if (delta !== 0) {
      const wasAtEnd =
        this.options.anchorTo === 'end' &&
        this.scrollState?.behavior !== 'smooth' &&
        this.getVirtualDistanceFromEnd() <= this.options.scrollEndThreshold
      const prevTotalSize = wasAtEnd ? this.getTotalSize() : 0
      const shouldAdjustScroll =
        this.scrollState?.behavior !== 'smooth' &&
        (this.shouldAdjustScrollPositionOnItemSizeChange !== undefined
          ? this.shouldAdjustScrollPositionOnItemSizeChange(
              // The callback expects a VirtualItem; build one lazily only
              // when the consumer actually supplied a custom predicate.
              this.measurementsCache[index] ?? {
                index,
                key,
                start: itemStart,
                size: cachedSize,
                end: itemStart + cachedSize,
                lane: 0,
              },
              delta,
              this,
            )
          : // Default: adjust when the resize is an above-viewport item.
            // First measurement (!has(key)): always adjust — the item
            // has never been sized, so the estimate→actual delta must
            // be compensated regardless of scroll direction.
            // Re-measurement (has(key)): skip during backward scroll
            // to avoid the "items jump while scrolling up" cascade.
            itemStart < this.getScrollOffset() + this.scrollAdjustments &&
            (!this.itemSizeCache.has(key) ||
              this.scrollDirection !== 'backward'))

      if (this.pendingMin === null || index < this.pendingMin) {
        this.pendingMin = index
      }
      this.itemSizeCache.set(key, size)
      this.itemSizeCacheVersion++

      if (wasAtEnd) {
        this.applyScrollAdjustment(this.getTotalSize() - prevTotalSize)
      } else if (shouldAdjustScroll) {
        this.applyScrollAdjustment(delta)
      }

      this.notify(false)
    }
  }

  getVirtualItems = memo(
    () => [this.getVirtualIndexes(), this.getMeasurements()],
    (indexes, measurements) => {
      const virtualItems: Array<VirtualItem> = []

      for (let k = 0, len = indexes.length; k < len; k++) {
        const i = indexes[k]!
        const measurement = measurements[i]!

        virtualItems.push(measurement)
      }

      return virtualItems
    },
    {
      key: process.env.NODE_ENV !== 'production' && 'getVirtualItems',
      debug: () => this.options.debug,
    },
  )

  getVirtualItemForOffset = (offset: number) => {
    const measurements = this.getMeasurements()
    if (measurements.length === 0) {
      return undefined
    }
    // Same fast-path as calculateRange: read start values directly from the
    // typed array during binary search to skip the Proxy.get materialization
    // per probe.
    const flat = this._flatMeasurements
    const useFlat = this.options.lanes === 1 && flat != null
    const idx = findNearestBinarySearch(
      0,
      measurements.length - 1,
      useFlat
        ? (i: number) => flat[i * 2]!
        : (i: number) => notUndefined(measurements[i]).start,
      offset,
    )
    return notUndefined(measurements[idx])
  }

  private getMaxScrollOffset = () => {
    if (!this.scrollElement) return 0

    if ('scrollHeight' in this.scrollElement) {
      // Element
      return this.options.horizontal
        ? this.scrollElement.scrollWidth - this.scrollElement.clientWidth
        : this.scrollElement.scrollHeight - this.scrollElement.clientHeight
    } else {
      // Window
      const doc = this.scrollElement.document.documentElement
      return this.options.horizontal
        ? doc.scrollWidth - this.scrollElement.innerWidth
        : doc.scrollHeight - this.scrollElement.innerHeight
    }
  }

  private getVirtualDistanceFromEnd = () => {
    return Math.max(
      this.getTotalSize() - this.getSize() - this.getScrollOffset(),
      0,
    )
  }

  getDistanceFromEnd = () => {
    return Math.max(this.getMaxScrollOffset() - this.getScrollOffset(), 0)
  }

  isAtEnd = (threshold = this.options.scrollEndThreshold) => {
    return this.getDistanceFromEnd() <= threshold
  }

  getOffsetForAlignment = (
    toOffset: number,
    align: ScrollAlignment,
    itemSize = 0,
  ) => {
    if (!this.scrollElement) return 0

    const size = this.getSize()
    const scrollOffset = this.getScrollOffset()

    if (align === 'auto') {
      align = toOffset >= scrollOffset + size ? 'end' : 'start'
    }

    if (align === 'center') {
      // When aligning to a particular item (e.g. with scrollToIndex),
      // adjust offset by the size of the item to center on the item
      toOffset += (itemSize - size) / 2
    } else if (align === 'end') {
      toOffset -= size
    }

    const maxOffset = this.getMaxScrollOffset()

    return Math.max(Math.min(maxOffset, toOffset), 0)
  }

  getOffsetForIndex = (index: number, align: ScrollAlignment = 'auto') => {
    index = Math.max(0, Math.min(index, this.options.count - 1))

    const size = this.getSize()
    const scrollOffset = this.getScrollOffset()

    const item = this.measurementsCache[index]
    if (!item) return

    if (align === 'auto') {
      if (item.end >= scrollOffset + size - this.options.scrollPaddingEnd) {
        align = 'end'
      } else if (item.start <= scrollOffset + this.options.scrollPaddingStart) {
        align = 'start'
      } else {
        return [scrollOffset, align] as const
      }
    }

    // For the last item with 'end' alignment, use browser's actual max scroll
    // to account for borders/padding that aren't in our measurements
    if (align === 'end' && index === this.options.count - 1) {
      return [this.getMaxScrollOffset(), align] as const
    }

    const toOffset =
      align === 'end'
        ? item.end + this.options.scrollPaddingEnd
        : item.start - this.options.scrollPaddingStart

    return [
      this.getOffsetForAlignment(toOffset, align, item.size),
      align,
    ] as const
  }

  scrollToOffset = (
    toOffset: number,
    { align = 'start', behavior = 'auto' }: ScrollToOffsetOptions = {},
  ) => {
    const offset = this.getOffsetForAlignment(toOffset, align)

    const now = this.now()
    this.scrollState = {
      index: null,
      align,
      behavior,
      startedAt: now,
      lastTargetOffset: offset,
      stableFrames: 0,
    }

    this._scrollToOffset(offset, { adjustments: undefined, behavior })

    this.scheduleScrollReconcile()
  }

  scrollToIndex = (
    index: number,
    {
      align: initialAlign = 'auto',
      behavior = 'auto',
    }: ScrollToIndexOptions = {},
  ) => {
    index = Math.max(0, Math.min(index, this.options.count - 1))

    const offsetInfo = this.getOffsetForIndex(index, initialAlign)
    if (!offsetInfo) {
      return
    }
    const [offset, align] = offsetInfo

    const now = this.now()
    this.scrollState = {
      index,
      align,
      behavior,
      startedAt: now,
      lastTargetOffset: offset,
      stableFrames: 0,
    }

    this._scrollToOffset(offset, { adjustments: undefined, behavior })

    this.scheduleScrollReconcile()
  }

  scrollBy = (
    delta: number,
    { behavior = 'auto' }: ScrollToOffsetOptions = {},
  ) => {
    const offset = this.getScrollOffset() + delta
    const now = this.now()

    this.scrollState = {
      index: null,
      align: 'start',
      behavior,
      startedAt: now,
      lastTargetOffset: offset,
      stableFrames: 0,
    }

    this._scrollToOffset(offset, { adjustments: undefined, behavior })

    this.scheduleScrollReconcile()
  }

  scrollToEnd = ({ behavior = 'auto' }: ScrollToEndOptions = {}) => {
    if (this.options.count > 0) {
      this.scrollToIndex(this.options.count - 1, {
        align: 'end',
        behavior,
      })
      return
    }

    this.scrollToOffset(Math.max(this.getTotalSize() - this.getSize(), 0), {
      behavior,
    })
  }

  getTotalSize = () => {
    const measurements = this.getMeasurements()

    let end: number
    // If there are no measurements, set the end to paddingStart
    // If there is only one lane, use the last measurement's end
    // Otherwise find the maximum end value among all measurements
    if (measurements.length === 0) {
      end = this.options.paddingStart
    } else if (this.options.lanes === 1) {
      // Fast path: read last item's end directly from the flat typed array
      // when available; avoids a Proxy.get + VirtualItem materialization
      // just to call getTotalSize (which React renders trigger every commit).
      const lastIdx = measurements.length - 1
      const flat = this._flatMeasurements
      if (flat != null) {
        end = flat[lastIdx * 2]! + flat[lastIdx * 2 + 1]!
      } else {
        end = measurements[lastIdx]?.end ?? 0
      }
    } else {
      const endByLane = Array<number | null>(this.options.lanes).fill(null)
      let endIndex = measurements.length - 1
      while (endIndex >= 0 && endByLane.some((val) => val === null)) {
        const item = measurements[endIndex]!
        if (endByLane[item.lane] === null) {
          endByLane[item.lane] = item.end
        }

        endIndex--
      }

      end = Math.max(...endByLane.filter((val): val is number => val !== null))
    }

    return Math.max(
      end - this.options.scrollMargin + this.options.paddingEnd,
      0,
    )
  }

  /**
   * Returns a snapshot of currently-measured items suitable for round-
   * tripping through state storage (sessionStorage, history, etc.) and
   * passing back as `initialMeasurementsCache` on remount. Pair with the
   * current `scrollOffset` to restore exact scroll position after navigation.
   *
   * Only items the consumer has actually rendered (and thus measured) appear
   * in the snapshot; unmeasured items will fall back to `estimateSize` on
   * restore. Returns an empty array if no items have been measured.
   */
  takeSnapshot = (): Array<VirtualItem> => {
    const snapshot: Array<VirtualItem> = []
    if (this.itemSizeCache.size === 0) return snapshot
    // Iterate measurementsCache only for indices whose key is in itemSizeCache
    // (i.e., have been measured). We build VirtualItem objects with the
    // current start/size/end so they can be persisted as plain data.
    const m = this.getMeasurements()
    for (const item of m) {
      if (item && this.itemSizeCache.has(item.key)) {
        // Force materialization (lazy path) and copy plain fields.
        snapshot.push({
          index: item.index,
          key: item.key,
          start: item.start,
          size: item.size,
          end: item.end,
          lane: item.lane,
        })
      }
    }
    return snapshot
  }

  private _scrollToOffset = (
    offset: number,
    {
      adjustments,
      behavior,
    }: {
      adjustments: number | undefined
      behavior: ScrollBehavior | undefined
    },
  ) => {
    // Record the intended logical scroll target so the next scroll event
    // can reconcile against subpixel rounding by the browser.
    this._intendedScrollOffset = offset + (adjustments ?? 0)
    this.options.scrollToFn(offset, { behavior, adjustments }, this)
  }

  measure = () => {
    // Reset pendingMin so the next getMeasurements rebuilds from index 0.
    // Without this, a prior resizeItem() that left pendingMin > 0 would
    // cause the rebuild to preserve stale items before that index.
    this.pendingMin = null
    this.itemSizeCache.clear()
    this.laneAssignments.clear() // Clear lane cache for full re-layout
    this.itemSizeCacheVersion++
    this.notify(false)
  }
}

const findNearestBinarySearch = (
  low: number,
  high: number,
  getCurrentValue: (i: number) => number,
  value: number,
) => {
  while (low <= high) {
    const middle = ((low + high) / 2) | 0
    const currentValue = getCurrentValue(middle)

    if (currentValue < value) {
      low = middle + 1
    } else if (currentValue > value) {
      high = middle - 1
    } else {
      return middle
    }
  }

  if (low > 0) {
    return low - 1
  } else {
    return 0
  }
}

// Monomorphic Float64Array variant — reads start values directly at stride
// 2 instead of through a getter closure. JITs the inner load to a typed-
// array bounds-check + load with no indirect call.
function findNearestBinarySearchFlat(
  flat: Float64Array,
  high: number,
  value: number,
) {
  let low = 0
  while (low <= high) {
    const middle = ((low + high) / 2) | 0
    const currentValue = flat[middle * 2]!

    if (currentValue < value) {
      low = middle + 1
    } else if (currentValue > value) {
      high = middle - 1
    } else {
      return middle
    }
  }
  return low > 0 ? low - 1 : 0
}

function calculateRangeImpl(
  measurements: Array<VirtualItem>,
  outerSize: number,
  scrollOffset: number,
  lanes: number,
  flat: Float64Array | null,
) {
  const lastIndex = measurements.length - 1

  // handle case when item count is less than or equal to lanes
  if (measurements.length <= lanes) {
    return { startIndex: 0, endIndex: lastIndex }
  }

  if (lanes === 1 && flat !== null) {
    // Hot single-lane path: typed-array reads, no closures, no Proxy traps.
    const startIndex = findNearestBinarySearchFlat(
      flat,
      lastIndex,
      scrollOffset,
    )
    let endIndex = startIndex
    const limit = scrollOffset + outerSize
    while (
      endIndex < lastIndex &&
      flat[endIndex * 2]! + flat[endIndex * 2 + 1]! < limit
    ) {
      endIndex++
    }
    return { startIndex, endIndex }
  }

  // Fallback (lanes > 1 or no flat array): closure-based reads.
  const getStart = (index: number) => measurements[index]!.start
  let startIndex = findNearestBinarySearch(0, lastIndex, getStart, scrollOffset)
  let endIndex = startIndex

  if (lanes === 1) {
    while (
      endIndex < lastIndex &&
      measurements[endIndex]!.end < scrollOffset + outerSize
    ) {
      endIndex++
    }
  } else if (lanes > 1) {
    // Expand forward until we include the visible items from all lanes
    // which are closer to the end of the virtualizer window
    const endPerLane = Array(lanes).fill(0)
    while (
      endIndex < lastIndex &&
      endPerLane.some((pos) => pos < scrollOffset + outerSize)
    ) {
      const item = measurements[endIndex]!
      endPerLane[item.lane] = item.end
      endIndex++
    }

    // Expand backward until we include all lanes' visible items
    // closer to the top
    const startPerLane = Array(lanes).fill(scrollOffset + outerSize)
    while (startIndex >= 0 && startPerLane.some((pos) => pos >= scrollOffset)) {
      const item = measurements[startIndex]!
      startPerLane[item.lane] = item.start
      startIndex--
    }

    // Align startIndex to the beginning of its lane
    startIndex = Math.max(0, startIndex - (startIndex % lanes))
    // Align endIndex to the end of its lane
    endIndex = Math.min(lastIndex, endIndex + (lanes - 1 - (endIndex % lanes)))
  }

  return { startIndex, endIndex }
}
