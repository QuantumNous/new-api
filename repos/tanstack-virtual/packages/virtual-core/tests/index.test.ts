import { expect, test, vi } from 'vitest'
import {
  Virtualizer,
  _resetIOSDetectionForTests,
  defaultRangeExtractor,
  elementScroll,
  observeElementOffset,
  observeWindowOffset,
  windowScroll,
} from '../src/index'

test('should export the Virtualizer class', () => {
  expect(Virtualizer).toBeDefined()
})

test('should return empty items for empty scroll element', () => {
  const virtualizer = new Virtualizer({
    count: 100,
    getScrollElement: () => null,
    estimateSize: () => 50,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  expect(virtualizer.getVirtualItems()).toEqual([])
})

test('should return correct total size with one item and multiple lanes', () => {
  const virtualizer = new Virtualizer({
    count: 1,
    lanes: 2,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  expect(virtualizer.getTotalSize()).toBe(50)
})

test('should correctly recalculate lane assignments when lane count changes', () => {
  // Create a mock scroll element
  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    offsetWidth: 400,
    offsetHeight: 600,
  } as unknown as HTMLDivElement

  // Mock ResizeObserver
  let resizeCallback: ((entries: any[]) => void) | null = null
  const mockResizeObserver = vi.fn((callback) => {
    resizeCallback = callback
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })
  global.ResizeObserver = mockResizeObserver as any

  // Create virtualizer with 3 lanes initially
  const virtualizer = new Virtualizer({
    count: 10,
    lanes: 3,
    estimateSize: () => 100,
    getScrollElement: () => mockScrollElement,
    scrollToFn: vi.fn(),
    observeElementRect: (instance, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  virtualizer._willUpdate()

  // Get initial measurements with 3 lanes
  let measurements = virtualizer['getMeasurements']()
  expect(measurements.length).toBe(10)

  // All lane assignments should be 0, 1, or 2 (3 lanes)
  measurements.forEach((item) => {
    expect(item.lane).toBeGreaterThanOrEqual(0)
    expect(item.lane).toBeLessThan(3)
  })

  // Change to 2 lanes
  virtualizer.setOptions({
    count: 10,
    lanes: 2,
    estimateSize: () => 100,
    getScrollElement: () => mockScrollElement,
    scrollToFn: vi.fn(),
    observeElementRect: (instance, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  virtualizer._willUpdate()

  // Get new measurements with 2 lanes
  measurements = virtualizer['getMeasurements']()
  expect(measurements.length).toBe(10)

  // All lane assignments should now be 0 or 1 (2 lanes)
  // This is the bug fix - previously some items could still have lane: 2
  measurements.forEach((item, index) => {
    expect(item.lane).toBeGreaterThanOrEqual(0)
    expect(item.lane).toBeLessThan(2)
  })

  // Verify no out of bounds access would occur
  const lanes = 2
  const columns = Array.from({ length: lanes }, () => [] as typeof measurements)
  measurements.forEach((item) => {
    // This should not throw
    expect(() => {
      columns[item.lane].push(item)
    }).not.toThrow()
  })
})

test('should update getTotalSize() when count option changes (filtering/search)', () => {
  const virtualizer = new Virtualizer({
    count: 100,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  expect(virtualizer.getTotalSize()).toBe(5000) // 100 × 50

  // Simulate filtering - reduce count to 20
  virtualizer.setOptions({
    count: 20,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  // getTotalSize() should immediately return updated value (not stale)
  expect(virtualizer.getTotalSize()).toBe(1000) // 20 × 50

  // Restore full count
  virtualizer.setOptions({
    count: 100,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  expect(virtualizer.getTotalSize()).toBe(5000) // 100 × 50
})

test('should not throw when component unmounts during scrollToIndex rAF loop', () => {
  // Collect rAF callbacks so we can flush them manually
  const rafCallbacks: Array<FrameRequestCallback> = []
  const mockRaf = vi.fn((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return rafCallbacks.length
  })

  const MockResizeObserver = vi.fn(function () {
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })

  const mockWindow = {
    requestAnimationFrame: mockRaf,
    cancelAnimationFrame: vi.fn(),
    ResizeObserver: MockResizeObserver,
  }

  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 1000,
    scrollHeight: 5000,
    offsetWidth: 400,
    offsetHeight: 600,
    ownerDocument: {
      defaultView: mockWindow,
    },
  } as unknown as HTMLDivElement

  const virtualizer = new Virtualizer({
    count: 100,
    estimateSize: () => 50,
    measureElement: (el) => el.getBoundingClientRect().height,
    getScrollElement: () => mockScrollElement,
    scrollToFn: vi.fn(),
    observeElementRect: (instance, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  // Initialize the virtualizer so targetWindow is set
  virtualizer._willUpdate()

  // Populate elementsCache so isDynamicMode() returns true.
  // This triggers the code path where the rAF callback calls
  // this.targetWindow!.requestAnimationFrame(verify)
  const mockElement = {
    getBoundingClientRect: () => ({ height: 50 }),
    isConnected: true,
    setAttribute: vi.fn(),
  } as unknown as HTMLElement
  virtualizer.elementsCache.set(0, mockElement)

  // Trigger scrollToIndex which schedules a rAF callback
  virtualizer.scrollToIndex(50)

  // Simulate component unmount — cleanup sets targetWindow to null
  const unmount = virtualizer._didMount()
  unmount()

  // Flush all pending rAF callbacks — this should not throw
  // Without the fix, this crashes with:
  // "Cannot read properties of null (reading 'requestAnimationFrame')"
  expect(() => {
    rafCallbacks.forEach((cb) => cb(0))
  }).not.toThrow()
})

test("should defer lane caching until measurement when laneAssignmentMode is 'measured'", () => {
  const virtualizer = new Virtualizer({
    count: 4,
    lanes: 2,
    estimateSize: () => 100,
    laneAssignmentMode: 'measured',
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  // No laneAssignments cached yet
  expect(virtualizer['laneAssignments'].size).toBe(0)

  // Simulate measurements
  virtualizer.resizeItem(0, 200)
  virtualizer.resizeItem(1, 50)
  virtualizer.resizeItem(2, 80)
  virtualizer.resizeItem(3, 120)

  const measurements = virtualizer['getMeasurements']()

  // After measurement: lane assignments based on actual sizes + cached
  expect(virtualizer['laneAssignments'].size).toBe(4)
  expect(measurements[2].lane).toBe(1) // lane 1 is shorter, so assigned there

  // Lane assignments remain stable after size changes
  const lanesBeforeResize = measurements.map((m) => m.lane)
  virtualizer.resizeItem(0, 50)
  virtualizer.resizeItem(1, 200)
  const lanesAfterResize = virtualizer['getMeasurements']().map((m) => m.lane)
  expect(lanesBeforeResize).toEqual(lanesAfterResize)
})

test("should cache lanes incrementally as items are measured when laneAssignmentMode is 'measured'", () => {
  const virtualizer = new Virtualizer({
    count: 4,
    lanes: 2,
    estimateSize: () => 100,
    laneAssignmentMode: 'measured',
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()
  expect(virtualizer['laneAssignments'].size).toBe(0)

  // Measure only the first 2 items (simulating viewport-visible items)
  virtualizer.resizeItem(0, 200)
  virtualizer.resizeItem(1, 50)

  const m1 = virtualizer['getMeasurements']()
  expect(virtualizer['laneAssignments'].size).toBe(2)

  const lane0 = m1[0].lane
  const lane1 = m1[1].lane

  // Measure the remaining items
  virtualizer.resizeItem(2, 80)
  virtualizer.resizeItem(3, 120)

  const m2 = virtualizer['getMeasurements']()
  expect(virtualizer['laneAssignments'].size).toBe(4)

  // Previously cached lanes must remain stable
  expect(m2[0].lane).toBe(lane0)
  expect(m2[1].lane).toBe(lane1)
})

test("should cache lanes immediately when laneAssignmentMode is 'estimate' (default)", () => {
  const virtualizer = new Virtualizer({
    count: 4,
    lanes: 2,
    estimateSize: () => 100,
    laneAssignmentMode: 'estimate',
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  expect(virtualizer['laneAssignments'].size).toBe(4)
})

function createMockEnvironment() {
  const rafCallbacks: Array<FrameRequestCallback> = []
  let rafIdCounter = 0
  const mockRaf = vi.fn((cb: FrameRequestCallback) => {
    rafCallbacks.push(cb)
    return ++rafIdCounter
  })
  const mockCancelRaf = vi.fn()

  const MockResizeObserver = vi.fn(function () {
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })

  const mockWindow = {
    requestAnimationFrame: mockRaf,
    cancelAnimationFrame: mockCancelRaf,
    performance: { now: () => Date.now() },
    ResizeObserver: MockResizeObserver,
  }

  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 1000,
    scrollHeight: 5000,
    clientWidth: 400,
    clientHeight: 600,
    offsetWidth: 400,
    offsetHeight: 600,
    ownerDocument: {
      defaultView: mockWindow,
    },
    scrollTo: vi.fn(),
  } as unknown as HTMLDivElement

  const scrollToFn = vi.fn()

  return { rafCallbacks, mockWindow, mockScrollElement, scrollToFn }
}

function createVirtualizer(
  mockScrollElement: HTMLDivElement,
  scrollToFn: ReturnType<typeof vi.fn>,
) {
  return new Virtualizer({
    count: 100,
    estimateSize: () => 50,
    getScrollElement: () => mockScrollElement,
    scrollToFn,
    observeElementRect: (_instance, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (_instance, cb) => {
      cb(0, false)
      return () => {}
    },
  })
}

test('scrollToIndex(0) should reconcile correctly', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollToIndex(0)

  // scrollToFn should have been called with offset for index 0
  expect(scrollToFn).toHaveBeenCalled()
  const calledOffset = scrollToFn.mock.calls[0]![0]
  expect(calledOffset).toBe(0)

  // Flush rAF — reconcileScroll should run and not bail
  // It should eventually clear scrollState (settle)
  rafCallbacks.forEach((cb) => cb(0))

  // scrollState should be cleared after settling
  expect(virtualizer['scrollState']).toBeNull()
})

test('scrollToOffset should reconcile and clear scrollState', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollToOffset(200)

  expect(scrollToFn).toHaveBeenCalled()

  // scrollState should be set with index: null
  expect(virtualizer['scrollState']).not.toBeNull()
  expect(virtualizer['scrollState']!.index).toBeNull()

  // Simulate the scroll offset reaching the target
  virtualizer.scrollOffset = 200

  // Flush rAF — reconciliation should settle and clear scrollState
  rafCallbacks.forEach((cb) => cb(0))

  expect(virtualizer['scrollState']).toBeNull()
})

test('scrollBy should reconcile and clear scrollState', () => {
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollBy(100)

  expect(virtualizer['scrollState']).not.toBeNull()
  expect(virtualizer['scrollState']!.index).toBeNull()

  // Simulate scroll offset reaching the target
  virtualizer.scrollOffset = 100

  rafCallbacks.forEach((cb) => cb(0))

  expect(virtualizer['scrollState']).toBeNull()
})

test('reconcileScroll should bail out after timeout', () => {
  const { rafCallbacks, mockWindow, mockScrollElement, scrollToFn } =
    createMockEnvironment()

  // Make performance.now() return a controllable value
  let fakeTime = 1000
  mockWindow.performance.now = () => fakeTime

  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)
  virtualizer._willUpdate()

  virtualizer.scrollToIndex(50)

  expect(virtualizer['scrollState']).not.toBeNull()

  // Advance time past the 5s safety valve
  fakeTime = 7000

  // Flush rAF — should trigger timeout bailout
  rafCallbacks.forEach((cb) => cb(0))

  expect(virtualizer['scrollState']).toBeNull()
})

test('cleanup should cancel pending RAF and clear scrollState', () => {
  const { mockWindow, mockScrollElement, scrollToFn } = createMockEnvironment()
  const virtualizer = createVirtualizer(mockScrollElement, scrollToFn)

  virtualizer._willUpdate()
  virtualizer.scrollToIndex(50)

  expect(virtualizer['scrollState']).not.toBeNull()
  expect(virtualizer['rafId']).not.toBeNull()

  const unmount = virtualizer._didMount()
  unmount()

  expect(virtualizer['scrollState']).toBeNull()
  expect(virtualizer['rafId']).toBeNull()
  expect(mockWindow.cancelAnimationFrame).toHaveBeenCalled()
})

// ─── resizeItem / measurement cache invalidation ─────────────────────────────
// These tests pin down the contract that resizeItem invalidates the
// getMeasurements memo so subsequent reads reflect the new sizes.
// They guard against regressions when changing the invalidation mechanism
// (e.g. Map clone → version counter).

test('resizeItem should persist size for a single index', () => {
  const virtualizer = new Virtualizer({
    count: 5,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  // Seed measurementsCache
  virtualizer['getMeasurements']()

  virtualizer.resizeItem(2, 130)

  const measurements = virtualizer['getMeasurements']()
  expect(measurements[2]!.size).toBe(130)
  // Items after should be shifted by the delta (130 - 50 = 80)
  expect(measurements[3]!.start).toBe(50 + 50 + 130)
  expect(measurements[4]!.start).toBe(50 + 50 + 130 + 50)
})

test('resizeItem should persist sizes across many sequential calls', () => {
  const N = 50
  const virtualizer = new Virtualizer({
    count: N,
    estimateSize: () => 10,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  // Resize every item to a unique size
  for (let i = 0; i < N; i++) {
    virtualizer.resizeItem(i, 100 + i)
  }

  const measurements = virtualizer['getMeasurements']()
  let runningStart = 0
  for (let i = 0; i < N; i++) {
    expect(measurements[i]!.size).toBe(100 + i)
    expect(measurements[i]!.start).toBe(runningStart)
    runningStart += 100 + i
  }
})

test('resizeItem should invalidate getMeasurements memo even when same key resized twice', () => {
  const virtualizer = new Virtualizer({
    count: 3,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  virtualizer.resizeItem(1, 100)
  expect(virtualizer['getMeasurements']()[1]!.size).toBe(100)

  virtualizer.resizeItem(1, 200)
  expect(virtualizer['getMeasurements']()[1]!.size).toBe(200)

  virtualizer.resizeItem(1, 75)
  expect(virtualizer['getMeasurements']()[1]!.size).toBe(75)
})

test('resizeItem with same size as cached should be a no-op (no invalidation)', () => {
  const virtualizer = new Virtualizer({
    count: 3,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()
  virtualizer.resizeItem(0, 80)
  const before = virtualizer['getMeasurements']()
  const beforeRef = before
  // Same value, should short-circuit (delta === 0)
  virtualizer.resizeItem(0, 80)
  const after = virtualizer['getMeasurements']()
  // Memo should return the same array reference
  expect(after).toBe(beforeRef)
})

test('measure() should clear size cache and lane assignments', () => {
  const virtualizer = new Virtualizer({
    count: 4,
    lanes: 2,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()
  virtualizer.resizeItem(0, 200)
  virtualizer.resizeItem(1, 100)

  expect(virtualizer['itemSizeCache'].size).toBe(2)
  expect(virtualizer['laneAssignments'].size).toBeGreaterThan(0)

  virtualizer.measure()

  expect(virtualizer['itemSizeCache'].size).toBe(0)
  expect(virtualizer['laneAssignments'].size).toBe(0)

  // After measure(), sizes should fall back to estimateSize
  const measurements = virtualizer['getMeasurements']()
  expect(measurements[0]!.size).toBe(50)
  expect(measurements[1]!.size).toBe(50)
})

test('measure() should fully invalidate when a later index was dirtied without an intervening getMeasurements()', () => {
  // Regression: measure() used to clear itemSizeCache but not pendingMin.
  // If resizeItem() had been called without a subsequent getMeasurements()
  // to flush pendingMin, the next rebuild would preserve measurementsCache
  // entries before that index — even though measure() is supposed to wipe
  // everything.
  const virtualizer = new Virtualizer({
    count: 6,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  // Seed item 0 with a non-estimate size, then flush so it's in measurementsCache.
  virtualizer.resizeItem(0, 999)
  virtualizer['getMeasurements']()
  // Now dirty a later index without flushing — pendingMin will be 2.
  virtualizer.resizeItem(2, 888)
  expect(virtualizer['pendingMin']).toBe(2)

  virtualizer.measure()

  // After measure(), pendingMin must be null so the rebuild starts at 0
  // and discards the stale item-0 entry.
  expect(virtualizer['pendingMin']).toBe(null)

  const m = virtualizer['getMeasurements']()
  expect(m[0]!.size).toBe(50)
  expect(m[2]!.size).toBe(50)
})

test('measure() should trigger a re-measurement on subsequent getMeasurements', () => {
  let sizeFn = (i: number) => 50
  const virtualizer = new Virtualizer({
    count: 3,
    estimateSize: (i) => sizeFn(i),
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  const before = virtualizer['getMeasurements']()
  expect(before[0]!.size).toBe(50)

  // Change the estimateSize function via setOptions
  sizeFn = () => 100
  virtualizer.measure()

  const after = virtualizer['getMeasurements']()
  expect(after[0]!.size).toBe(100)
})

test('resizeItem on unknown index is a no-op', () => {
  const virtualizer = new Virtualizer({
    count: 3,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()
  // Index out of bounds — should not crash
  expect(() => virtualizer.resizeItem(99, 100)).not.toThrow()

  // Cache should be untouched
  expect(virtualizer['itemSizeCache'].size).toBe(0)
})

test('resizeItem out-of-order should produce correct positions regardless of measurement order', () => {
  const N = 10
  const virtualizer = new Virtualizer({
    count: N,
    estimateSize: () => 20,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  // Resize in reverse order — should still produce a valid prefix-sum
  for (let i = N - 1; i >= 0; i--) {
    virtualizer.resizeItem(i, 30 + i)
  }

  const measurements = virtualizer['getMeasurements']()
  let runningStart = 0
  for (let i = 0; i < N; i++) {
    expect(measurements[i]!.size).toBe(30 + i)
    expect(measurements[i]!.start).toBe(runningStart)
    runningStart += 30 + i
  }
})

test('getMeasurements memo should return same array reference when nothing changed', () => {
  const virtualizer = new Virtualizer({
    count: 5,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  const a = virtualizer['getMeasurements']()
  const b = virtualizer['getMeasurements']()
  expect(a).toBe(b)
})

test('getMeasurements memo should return new array reference after resizeItem', () => {
  const virtualizer = new Virtualizer({
    count: 5,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  const a = virtualizer['getMeasurements']()
  virtualizer.resizeItem(0, 100)
  const b = virtualizer['getMeasurements']()
  expect(a).not.toBe(b)
  expect(b[0]!.size).toBe(100)
})

// ─── elementsCache leak: disconnected node cleanup ───────────────────────────

test('RO callback should remove disconnected node from elementsCache', () => {
  // Pins down that when the ResizeObserver fires for a node that has been
  // disconnected from the DOM, that node is removed from elementsCache.
  // Without the fix, elementsCache accumulates stale entries.
  let roCallback: ResizeObserverCallback | null = null
  const MockResizeObserver = vi.fn(function (cb: ResizeObserverCallback) {
    roCallback = cb
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })

  const mockWindow = {
    requestAnimationFrame: vi.fn(),
    cancelAnimationFrame: vi.fn(),
    performance: { now: () => Date.now() },
    ResizeObserver: MockResizeObserver,
  }

  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 1000,
    scrollHeight: 5000,
    offsetWidth: 400,
    offsetHeight: 600,
    ownerDocument: { defaultView: mockWindow },
  } as unknown as HTMLDivElement

  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => mockScrollElement,
    scrollToFn: vi.fn(),
    observeElementRect: (_inst, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (_inst, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  virtualizer._willUpdate()

  // Simulate React mounting an element by calling measureElement ref callback
  const node = {
    getAttribute: (name: string) => (name === 'data-index' ? '3' : null),
    getBoundingClientRect: () => ({ height: 50, width: 400 }),
    isConnected: true,
    setAttribute: vi.fn(),
  } as unknown as HTMLElement

  virtualizer.measureElement(node)
  expect(virtualizer.elementsCache.get(3)).toBe(node)

  // Now simulate the node being disconnected from DOM
  ;(node as any).isConnected = false

  // Fire the RO callback for this node — pretending it just resized
  expect(roCallback).not.toBeNull()
  roCallback!(
    [
      {
        target: node,
        contentRect: { height: 50, width: 400 } as DOMRectReadOnly,
        borderBoxSize: [{ blockSize: 50, inlineSize: 400 }],
        contentBoxSize: [{ blockSize: 50, inlineSize: 400 }],
        devicePixelContentBoxSize: [{ blockSize: 50, inlineSize: 400 }],
      } as ResizeObserverEntry,
    ],
    {} as ResizeObserver,
  )

  // elementsCache should no longer contain the disconnected node
  expect(virtualizer.elementsCache.has(3)).toBe(false)
})

test('RO callback should not delete cache entry if node was replaced by React', () => {
  // Edge case: if React unmounts node A and mounts node B for the same key,
  // a delayed RO callback for the now-disconnected node A must not delete
  // the entry that now points to node B.
  let roCallback: ResizeObserverCallback | null = null
  const MockResizeObserver = vi.fn(function (cb: ResizeObserverCallback) {
    roCallback = cb
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })

  const mockWindow = {
    requestAnimationFrame: vi.fn(),
    cancelAnimationFrame: vi.fn(),
    performance: { now: () => Date.now() },
    ResizeObserver: MockResizeObserver,
  }

  const mockScrollElement = {
    scrollTop: 0,
    scrollLeft: 0,
    scrollWidth: 1000,
    scrollHeight: 5000,
    offsetWidth: 400,
    offsetHeight: 600,
    ownerDocument: { defaultView: mockWindow },
  } as unknown as HTMLDivElement

  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => mockScrollElement,
    scrollToFn: vi.fn(),
    observeElementRect: (_inst, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (_inst, cb) => {
      cb(0, false)
      return () => {}
    },
  })

  virtualizer._willUpdate()

  // Mount nodeA at index 3
  const nodeA = {
    getAttribute: () => '3',
    getBoundingClientRect: () => ({ height: 50, width: 400 }),
    isConnected: true,
    setAttribute: vi.fn(),
  } as unknown as HTMLElement
  virtualizer.measureElement(nodeA)
  expect(virtualizer.elementsCache.get(3)).toBe(nodeA)

  // Mount nodeB for the same index — replaces nodeA in elementsCache
  const nodeB = {
    getAttribute: () => '3',
    getBoundingClientRect: () => ({ height: 50, width: 400 }),
    isConnected: true,
    setAttribute: vi.fn(),
  } as unknown as HTMLElement
  virtualizer.measureElement(nodeB)
  expect(virtualizer.elementsCache.get(3)).toBe(nodeB)

  // Now fire a delayed RO callback for the now-disconnected nodeA.
  // This must NOT delete elementsCache[3] (which points to nodeB).
  ;(nodeA as any).isConnected = false
  roCallback!(
    [
      {
        target: nodeA,
        contentRect: { height: 50, width: 400 } as DOMRectReadOnly,
        borderBoxSize: [{ blockSize: 50, inlineSize: 400 }],
        contentBoxSize: [{ blockSize: 50, inlineSize: 400 }],
        devicePixelContentBoxSize: [{ blockSize: 50, inlineSize: 400 }],
      } as ResizeObserverEntry,
    ],
    {} as ResizeObserver,
  )

  expect(virtualizer.elementsCache.get(3)).toBe(nodeB)
})

// ─── setOptions behavioral contract ──────────────────────────────────────────
// These tests pin down how setOptions merges defaults with user-supplied opts.
// They guard against regressions when changing the merge mechanism
// (currently: mutate opts + spread with defaults; will become: copy-without-undefined).

test('setOptions: undefined values should fall back to defaults', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: 100,
  })

  // First confirm explicit value sticks
  expect(virtualizer.options.paddingStart).toBe(100)

  // Now setOptions with paddingStart: undefined → should fall back to default (0)
  virtualizer.setOptions({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: undefined as any,
  })

  expect(virtualizer.options.paddingStart).toBe(0)
})

test('setOptions: missing keys should fall back to defaults', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  // Defaults should apply for all unset options
  expect(virtualizer.options.paddingStart).toBe(0)
  expect(virtualizer.options.paddingEnd).toBe(0)
  expect(virtualizer.options.overscan).toBe(1)
  expect(virtualizer.options.horizontal).toBe(false)
  expect(virtualizer.options.gap).toBe(0)
  expect(virtualizer.options.lanes).toBe(1)
  expect(virtualizer.options.enabled).toBe(true)
})

test('setOptions: explicit falsy values (0, false) should NOT fall back to defaults', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: 50,
    overscan: 3,
    enabled: true,
  })

  // Now set them all to explicit falsy values
  virtualizer.setOptions({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: 0,
    overscan: 0,
    enabled: false,
  })

  expect(virtualizer.options.paddingStart).toBe(0)
  expect(virtualizer.options.overscan).toBe(0)
  expect(virtualizer.options.enabled).toBe(false)
})

test('setOptions: subsequent calls do not accumulate stale options', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: 100,
    overscan: 5,
  })

  // Now call again with only count — paddingStart and overscan should reset to defaults
  virtualizer.setOptions({
    count: 20,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  expect(virtualizer.options.count).toBe(20)
  expect(virtualizer.options.paddingStart).toBe(0)
  expect(virtualizer.options.overscan).toBe(1)
})

test('setOptions: does not mutate the caller-supplied opts object', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  const userOpts = {
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    paddingStart: undefined as any,
    overscan: undefined as any,
  }
  const beforeKeys = Object.keys(userOpts).sort()

  virtualizer.setOptions(userOpts)

  const afterKeys = Object.keys(userOpts).sort()
  expect(afterKeys).toEqual(beforeKeys)
  // Specifically: undefined-valued keys should still exist on the user's object
  expect('paddingStart' in userOpts).toBe(true)
  expect('overscan' in userOpts).toBe(true)
})

// ─── pending min pointer for measure storms ──────────────────────────────────

test('resizeItem random order should rebuild from earliest dirty index', () => {
  // This pins down the min-of-pending-indices behavior. If indices 5, 0, 8 are
  // dirtied in that order, getMeasurements must rebuild from index 0 onward so
  // all later items have correct offsets.
  const N = 20
  const virtualizer = new Virtualizer({
    count: N,
    estimateSize: () => 10,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  virtualizer.resizeItem(5, 50)
  virtualizer.resizeItem(0, 30)
  virtualizer.resizeItem(8, 70)
  virtualizer.resizeItem(15, 100)
  virtualizer.resizeItem(3, 40)

  const measurements = virtualizer['getMeasurements']()
  // Sizes
  expect(measurements[0]!.size).toBe(30)
  expect(measurements[3]!.size).toBe(40)
  expect(measurements[5]!.size).toBe(50)
  expect(measurements[8]!.size).toBe(70)
  expect(measurements[15]!.size).toBe(100)

  // Verify start/end are correct (prefix-sum invariant) for ALL items,
  // even those that were not resized — they must have absorbed the shifts
  // from earlier resized items.
  let runningStart = 0
  for (let i = 0; i < N; i++) {
    expect(measurements[i]!.start).toBe(runningStart)
    runningStart += measurements[i]!.size
  }
})

test('resizeItem in massive storm (10k items) does not crash on min lookup', () => {
  // Regression: Math.min(...arr) spreads the array onto the call stack.
  // V8's argument-list limit is around 125k. With many pending indices,
  // this can throw RangeError. We test 10k to be well within range but
  // catch any regression in the running-min mechanism.
  const N = 10_000
  const virtualizer = new Virtualizer({
    count: N,
    estimateSize: () => 10,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })

  virtualizer['getMeasurements']()

  // Resize every item before reading measurements — accumulates N pending indices
  for (let i = 0; i < N; i++) {
    virtualizer.resizeItem(i, 20 + (i % 13))
  }

  expect(() => virtualizer['getMeasurements']()).not.toThrow()
  const measurements = virtualizer['getMeasurements']()
  expect(measurements.length).toBe(N)
  // Verify last item has correct prefix-sum
  let expected = 0
  for (let i = 0; i < N; i++) expected += 20 + (i % 13)
  expect(measurements[N - 1]!.start + measurements[N - 1]!.size).toBe(expected)
})

// ─── defaultRangeExtractor ───────────────────────────────────────────────────

test('defaultRangeExtractor: simple range with no overscan', () => {
  const result = defaultRangeExtractor({
    startIndex: 5,
    endIndex: 10,
    overscan: 0,
    count: 100,
  })
  expect(result).toEqual([5, 6, 7, 8, 9, 10])
})

test('defaultRangeExtractor: range with overscan', () => {
  const result = defaultRangeExtractor({
    startIndex: 5,
    endIndex: 10,
    overscan: 2,
    count: 100,
  })
  expect(result).toEqual([3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
})

test('defaultRangeExtractor: clamps start to 0 when overscan would go negative', () => {
  const result = defaultRangeExtractor({
    startIndex: 1,
    endIndex: 5,
    overscan: 5,
    count: 100,
  })
  expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  expect(result[0]).toBe(0)
})

test('defaultRangeExtractor: clamps end to count-1 when overscan would go past', () => {
  const result = defaultRangeExtractor({
    startIndex: 95,
    endIndex: 99,
    overscan: 5,
    count: 100,
  })
  expect(result).toEqual([90, 91, 92, 93, 94, 95, 96, 97, 98, 99])
  expect(result[result.length - 1]).toBe(99)
})

test('defaultRangeExtractor: single item range', () => {
  const result = defaultRangeExtractor({
    startIndex: 5,
    endIndex: 5,
    overscan: 0,
    count: 100,
  })
  expect(result).toEqual([5])
})

test('defaultRangeExtractor: returns a plain Array (not iterable proxy)', () => {
  const result = defaultRangeExtractor({
    startIndex: 0,
    endIndex: 3,
    overscan: 0,
    count: 100,
  })
  expect(Array.isArray(result)).toBe(true)
  expect(result.length).toBe(4)
})

test('defaultRangeExtractor: large range produces correct length', () => {
  const result = defaultRangeExtractor({
    startIndex: 0,
    endIndex: 999,
    overscan: 0,
    count: 1000,
  })
  expect(result.length).toBe(1000)
  expect(result[0]).toBe(0)
  expect(result[999]).toBe(999)
})

// ─── Lazy fast path (lanes === 1) edge cases ─────────────────────────────────
// Pins down behavior of the typed-array-backed lazy measurements view.

test('lazy fast path: empty list (count=0)', () => {
  const v = new Virtualizer({
    count: 0,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  expect(m.length).toBe(0)
  expect(v.getTotalSize()).toBe(0)
})

test('lazy fast path: respects paddingStart + scrollMargin + gap', () => {
  const v = new Virtualizer({
    count: 5,
    estimateSize: () => 40,
    paddingStart: 10,
    scrollMargin: 20,
    gap: 8,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  // First item starts at paddingStart + scrollMargin = 30
  expect(m[0]!.start).toBe(30)
  expect(m[0]!.size).toBe(40)
  expect(m[0]!.end).toBe(70)
  // Subsequent items separated by gap
  expect(m[1]!.start).toBe(70 + 8) // prev.end + gap
  expect(m[1]!.size).toBe(40)
})

test('lazy fast path: VirtualItem fields are correct', () => {
  const v = new Virtualizer({
    count: 3,
    estimateSize: () => 50,
    getItemKey: (i) => `item-${i}`,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  expect(m[0]!.index).toBe(0)
  expect(m[0]!.key).toBe('item-0')
  expect(m[0]!.start).toBe(0)
  expect(m[0]!.size).toBe(50)
  expect(m[0]!.end).toBe(50)
  expect(m[0]!.lane).toBe(0)
  expect(m[1]!.index).toBe(1)
  expect(m[1]!.key).toBe('item-1')
  expect(m[2]!.key).toBe('item-2')
})

test('lazy fast path: same item read twice returns identical reference (cache works)', () => {
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  const a = m[5]
  const b = m[5]
  expect(a).toBe(b)
})

test('lazy fast path: out-of-range access returns undefined', () => {
  const v = new Virtualizer({
    count: 5,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  expect(m[10]).toBeUndefined()
  expect(m[-1]).toBeUndefined()
  expect(m[5]).toBeUndefined()
})

test('lazy fast path: getTotalSize after resizeItem reflects new size', () => {
  const v = new Virtualizer({
    count: 5,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  expect(v.getTotalSize()).toBe(150)
  v.resizeItem(2, 100)
  expect(v.getTotalSize()).toBe(120 + 100) // 4 * 30 + 100
})

test('lazy fast path: getVirtualItemForOffset binary search returns correct item', () => {
  const v = new Virtualizer({
    count: 100,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const found = v.getVirtualItemForOffset(500)
  // Item at offset 500 should be index 16 (500/30 = 16.67)
  expect(found?.index).toBe(16)
  expect(found?.start).toBe(480)
  expect(found?.end).toBe(510)
})

test('lazy fast path: 1M-item list returns a sparse view, not an eagerly-allocated array', () => {
  // Functional contract for the lazy fast path: a 1M-item virtualizer
  // returns measurements that report the correct total length and produce
  // exact start/size/end values on indexed access without requiring the
  // whole array to be materialized. Sparse spot-checks across the range
  // would fail if the fast path were silently allocating N VirtualItems
  // (or if the typed-array backing computed offsets incorrectly).
  const v = new Virtualizer({
    count: 1_000_000,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  expect(m.length).toBe(1_000_000)
  expect(m[0]!.start).toBe(0)
  expect(m[0]!.size).toBe(30)
  expect(m[0]!.end).toBe(30)
  expect(m[500_000]!.start).toBe(15_000_000)
  expect(m[500_000]!.end).toBe(15_000_030)
  expect(m[999_999]!.start).toBe(29_999_970)
  expect(m[999_999]!.end).toBe(30_000_000)
})

// ─── iOS momentum-safe scroll adjustments ───────────────────────────────────

function withFakeIOSUserAgent<T>(fn: () => T): T {
  // jsdom navigator.userAgent lives on the prototype; we set an own property
  // to shadow it, then remove the own property in finally so the prototype
  // value is visible again for subsequent tests.
  Object.defineProperty(navigator, 'userAgent', {
    value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
    configurable: true,
  })
  _resetIOSDetectionForTests()
  try {
    return fn()
  } finally {
    delete (navigator as any).userAgent
    _resetIOSDetectionForTests()
  }
}

test('iOS deferral: scroll-position write is deferred during isScrolling', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let scrollCallback:
      | ((offset: number, isScrolling: boolean) => void)
      | null = null
    const v = new Virtualizer({
      count: 10,
      estimateSize: () => 50,
      getScrollElement: () =>
        ({
          scrollTop: 100,
          scrollLeft: 0,
          scrollHeight: 500,
          clientHeight: 200,
          offsetHeight: 200,
        }) as any,
      scrollToFn,
      observeElementRect: () => {},
      observeElementOffset: (_inst, cb) => {
        scrollCallback = cb
        cb(100, true) // Start scrolling
        return () => {}
      },
    })
    v._willUpdate()
    v['getMeasurements']()
    scrollToFn.mockClear()

    // Resize an item above the current scroll position while isScrolling=true
    // The default condition (item.start < scrollOffset + scrollAdjustments)
    // would normally trigger an immediate scroll adjustment.
    v.resizeItem(0, 100) // item 0 was at start=0; now 50→100 grows by 50

    // On iOS during scroll, the adjustment should be DEFERRED — scrollToFn
    // should NOT have been called for the adjustment.
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_iosDeferredAdjustment']).toBe(50)

    // Now transition isScrolling → false
    scrollCallback!(100, false)

    // The deferred adjustment should be flushed.
    expect(scrollToFn).toHaveBeenCalled()
    expect(v['_iosDeferredAdjustment']).toBe(0)
  })
})

test('iOS deferral: multiple resizes during scroll accumulate and flush as one', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let scrollCallback:
      | ((offset: number, isScrolling: boolean) => void)
      | null = null
    const v = new Virtualizer({
      count: 10,
      estimateSize: () => 50,
      getScrollElement: () =>
        ({
          scrollTop: 200,
          scrollLeft: 0,
          scrollHeight: 500,
          clientHeight: 200,
          offsetHeight: 200,
        }) as any,
      scrollToFn,
      observeElementRect: () => {},
      observeElementOffset: (_inst, cb) => {
        scrollCallback = cb
        cb(200, true)
        return () => {}
      },
    })
    v._willUpdate()
    v['getMeasurements']()
    scrollToFn.mockClear()

    // Three resizes during scroll: 10 + 15 + 20 = 45 total
    v.resizeItem(0, 60)
    v.resizeItem(1, 65)
    v.resizeItem(2, 70)

    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_iosDeferredAdjustment']).toBe(45)

    scrollCallback!(200, false)
    // Single flush call
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v['_iosDeferredAdjustment']).toBe(0)
  })
})

test('iOS deferral: flushed delta is rolled into scrollAdjustments so back-to-back resizes stay consistent', () => {
  // Regression: the deferred flush used to write `adjustments: delta`
  // directly without updating `this.scrollAdjustments`. If a second resize
  // landed before the resulting scroll event fired (and reset the
  // accumulator), the comparison `itemStart < getScrollOffset() +
  // scrollAdjustments` would miss the flushed delta and the next correction
  // would compute from the stale offset.
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let scrollCallback:
      | ((offset: number, isScrolling: boolean) => void)
      | null = null
    const v = new Virtualizer({
      count: 10,
      estimateSize: () => 50,
      getScrollElement: () =>
        ({
          scrollTop: 200,
          scrollLeft: 0,
          scrollHeight: 500,
          clientHeight: 200,
          offsetHeight: 200,
        }) as any,
      scrollToFn,
      observeElementRect: () => {},
      observeElementOffset: (_inst, cb) => {
        scrollCallback = cb
        cb(200, true)
        return () => {}
      },
    })
    v._willUpdate()
    v['getMeasurements']()
    scrollToFn.mockClear()

    // Build up a deferred adjustment of 50 during scroll.
    v.resizeItem(0, 100)
    expect(v['_iosDeferredAdjustment']).toBe(50)
    expect(v['scrollAdjustments']).toBe(0)

    // Settle: scroll event resets scrollAdjustments to 0, then the flush
    // runs and must roll the deferred delta back into scrollAdjustments.
    scrollCallback!(200, false)

    expect(scrollToFn).toHaveBeenCalledTimes(1)
    const [, opts] = scrollToFn.mock.calls[0]!
    expect(opts.adjustments).toBe(50)
    // The running accumulator must now reflect the flushed delta — any
    // resize landing before the resulting scroll event fires has to see
    // the correct effective offset.
    expect(v['scrollAdjustments']).toBe(50)
  })
})

// ─── Phase 1: touch event distinction ────────────────────────────────────────

// Mock EventTarget that records listeners so tests can dispatch events
// without requiring a real DOM. Works in any environment, jsdom or not.
function makeMockScrollElement(props: Record<string, any>) {
  const listeners = new Map<string, Set<(e: Event) => void>>()
  return {
    ...props,
    addEventListener(name: string, fn: (e: Event) => void) {
      let s = listeners.get(name)
      if (!s) listeners.set(name, (s = new Set()))
      s.add(fn)
    },
    removeEventListener(name: string, fn: (e: Event) => void) {
      listeners.get(name)?.delete(fn)
    },
    _dispatch(name: string) {
      listeners.get(name)?.forEach((fn) => fn({} as Event))
    },
  } as any
}

function makeIOSVirtualizerWithRealEl(
  scrollToFn: ReturnType<typeof vi.fn>,
  mockWindow: any,
) {
  const el = makeMockScrollElement({
    scrollTop: 100,
    scrollLeft: 0,
    scrollHeight: 500,
    clientHeight: 200,
    offsetHeight: 200,
    ownerDocument: { defaultView: mockWindow },
  })
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => el as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      cb(100, false)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  return { v, el }
}

function dispatchTouchEvent(el: any, type: 'touchstart' | 'touchend') {
  el._dispatch(type)
}

test('iOS Phase 1: touchstart sets _iosTouching=true and clears justTouchEnded', () => {
  withFakeIOSUserAgent(() => {
    const mockWindow = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(vi.fn(), mockWindow)
    ;(v as any)._iosJustTouchEnded = true // pretend a prior touchend left this set
    dispatchTouchEvent(el, 'touchstart')
    expect(v['_iosTouching']).toBe(true)
    expect(v['_iosJustTouchEnded']).toBe(false)
  })
})

test('iOS Phase 1: touchend sets justTouchEnded + starts grace timer, then expires', async () => {
  await withFakeIOSUserAgent(async () => {
    let timerId = 0
    const timers = new Map<number, () => void>()
    const mockWindow = {
      setTimeout: (fn: () => void, _ms: number) => {
        const id = ++timerId
        timers.set(id, fn)
        return id
      },
      clearTimeout: (id: number) => timers.delete(id),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(vi.fn(), mockWindow)
    dispatchTouchEvent(el, 'touchstart')
    dispatchTouchEvent(el, 'touchend')
    expect(v['_iosTouching']).toBe(false)
    expect(v['_iosJustTouchEnded']).toBe(true)
    expect(v['_iosTouchEndTimerId']).not.toBeNull()

    // Fire the timer manually (simulating 150ms elapsing).
    const fn = timers.get(v['_iosTouchEndTimerId']!)!
    fn()
    expect(v['_iosJustTouchEnded']).toBe(false)
    expect(v['_iosTouchEndTimerId']).toBeNull()
  })
})

test('iOS Phase 1: resize during active touch defers (no scrollTop write)', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    const mockWindow = {
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(scrollToFn, mockWindow)
    // Bring scroll state to a typical "user touched the screen" pose.
    dispatchTouchEvent(el, 'touchstart')
    scrollToFn.mockClear()

    // Above-viewport item resizes mid-drag. Must defer.
    v.resizeItem(0, 100)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_iosDeferredAdjustment']).toBe(50)
  })
})

test('iOS Phase 1: resize in post-touchend grace window defers; flushes when timer fires', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let timerId = 0
    const timers = new Map<number, () => void>()
    const mockWindow = {
      setTimeout: (fn: () => void, _ms: number) => {
        const id = ++timerId
        timers.set(id, fn)
        return id
      },
      clearTimeout: (id: number) => timers.delete(id),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(scrollToFn, mockWindow)
    dispatchTouchEvent(el, 'touchstart')
    dispatchTouchEvent(el, 'touchend')
    expect(v['_iosJustTouchEnded']).toBe(true)
    scrollToFn.mockClear()

    // Items measure during the grace window — must defer
    v.resizeItem(0, 100)
    v.resizeItem(1, 65)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_iosDeferredAdjustment']).toBe(50 + 15)

    // Expire the grace timer; the timer callback flushes the accumulated delta.
    const fn = timers.get(v['_iosTouchEndTimerId']!)!
    fn()
    expect(v['_iosJustTouchEnded']).toBe(false)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v['_iosDeferredAdjustment']).toBe(0)
  })
})

test('iOS Phase 1: scroll-event after touchend timer cleanup also flushes', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let scrollCallback: ((o: number, s: boolean) => void) | null = null
    const el = makeMockScrollElement({
      scrollTop: 100,
      scrollLeft: 0,
      scrollHeight: 500,
      clientHeight: 200,
      offsetHeight: 200,
      ownerDocument: {
        defaultView: {
          setTimeout: globalThis.setTimeout.bind(globalThis),
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
        },
      },
    })
    const v = new Virtualizer({
      count: 10,
      estimateSize: () => 50,
      getScrollElement: () => el as any,
      scrollToFn,
      observeElementRect: () => {},
      observeElementOffset: (_inst, cb) => {
        scrollCallback = cb
        cb(100, true) // scrolling
        return () => {}
      },
    })
    v._willUpdate()
    v['getMeasurements']()
    scrollToFn.mockClear()

    // Resize during scroll (no touch tracked here — pure scroll).
    v.resizeItem(0, 100)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_iosDeferredAdjustment']).toBe(50)

    // Scroll ends. Touch never started here, so the flush gate's
    // !isScrolling && !_iosTouching && !_iosJustTouchEnded all hold.
    scrollCallback!(100, false)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v['_iosDeferredAdjustment']).toBe(0)
  })
})

test('iOS Phase 1: new touchstart during grace window cancels pending flush timer', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let timerId = 0
    const timers = new Map<number, () => void>()
    const mockWindow = {
      setTimeout: (fn: () => void, _ms: number) => {
        const id = ++timerId
        timers.set(id, fn)
        return id
      },
      clearTimeout: (id: number) => timers.delete(id),
    }
    const { v, el } = makeIOSVirtualizerWithRealEl(scrollToFn, mockWindow)
    dispatchTouchEvent(el, 'touchstart')
    dispatchTouchEvent(el, 'touchend')
    const firstTimerId = v['_iosTouchEndTimerId']!
    expect(timers.has(firstTimerId)).toBe(true)

    // User puts finger back down before grace window expired.
    dispatchTouchEvent(el, 'touchstart')
    // The pending timer must have been canceled.
    expect(timers.has(firstTimerId)).toBe(false)
    expect(v['_iosTouchEndTimerId']).toBeNull()
    expect(v['_iosTouching']).toBe(true)
  })
})

// ─── Phase 2a: subpixel scrollTop reconciliation ─────────────────────────────

test('Phase 2a: browser-rounded scrollTop after self-write is reconciled to intended value', () => {
  let scrollCallback: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 0,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
        scrollTo: vi.fn(),
      }) as any,
    scrollToFn: vi.fn(),
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(0, false)
      return () => {}
    },
  })
  v._willUpdate()

  // Simulate a self-write to 123.5 (subpixel target).
  v.scrollToOffset(123.5, { behavior: 'auto' })
  expect(v['_intendedScrollOffset']).toBe(123.5)

  // Browser fires a scroll event reporting 123 (integer-rounded).
  scrollCallback!(123, false)

  // We should have reconciled the offset back to the intended 123.5,
  // not stored the browser's rounded 123.
  expect(v.scrollOffset).toBe(123.5)
  expect(v['_intendedScrollOffset']).toBeNull()
})

test('Phase 2a: user-initiated scroll (large delta) is NOT reconciled to intended value', () => {
  let scrollCallback: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 0,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
        scrollTo: vi.fn(),
      }) as any,
    scrollToFn: vi.fn(),
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(0, false)
      return () => {}
    },
  })
  v._willUpdate()
  v.scrollToOffset(100, { behavior: 'auto' })
  expect(v['_intendedScrollOffset']).toBe(100)

  // User then scrolls way past — browser reports 500. Diff (400) > 1.5 px
  // tolerance, so we trust the browser-reported value.
  scrollCallback!(500, true)
  expect(v.scrollOffset).toBe(500)
  expect(v['_intendedScrollOffset']).toBeNull()
})

// ─── Phase 2b: scrollTopMax elastic-overscroll clamp ─────────────────────────

test('Phase 2b: flush skipped when scrollTop is in elastic-overscroll zone (negative)', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let scrollCb: ((o: number, s: boolean) => void) | null = null
    const el = makeMockScrollElement({
      scrollTop: 100,
      scrollLeft: 0,
      scrollHeight: 500,
      clientHeight: 200,
      offsetHeight: 200,
      ownerDocument: {
        defaultView: {
          setTimeout: globalThis.setTimeout.bind(globalThis),
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
        },
      },
    })
    const v = new Virtualizer({
      count: 10,
      estimateSize: () => 50,
      getScrollElement: () => el as any,
      scrollToFn,
      observeElementRect: () => {},
      observeElementOffset: (_inst, cb) => {
        scrollCb = cb
        cb(100, true)
        return () => {}
      },
    })
    v._willUpdate()
    v['getMeasurements']()
    scrollToFn.mockClear()

    // Resize during scroll: defers
    v.resizeItem(0, 100)
    expect(v['_iosDeferredAdjustment']).toBe(50)

    // User rubber-bands past the top: scrollTop becomes negative.
    // Even though isScrolling=false now, the elastic-zone check blocks
    // the flush so we don't snap-back to a clamped position.
    el.scrollTop = -25
    scrollCb!(-25, false)
    expect(scrollToFn).not.toHaveBeenCalled()
    expect(v['_iosDeferredAdjustment']).toBe(50) // still deferred

    // User releases, scroll snaps back in-bounds. Next scroll event
    // should successfully flush.
    el.scrollTop = 100
    scrollCb!(100, false)
    expect(scrollToFn).toHaveBeenCalled()
    expect(v['_iosDeferredAdjustment']).toBe(0)
  })
})

test('Phase 2b: flush skipped when scrollTop > scrollHeight-clientHeight (overscroll bottom)', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let scrollCb: ((o: number, s: boolean) => void) | null = null
    const el = makeMockScrollElement({
      scrollTop: 100,
      scrollLeft: 0,
      scrollHeight: 500,
      clientHeight: 200, // max valid scrollTop = 300
      offsetHeight: 200,
      ownerDocument: {
        defaultView: {
          setTimeout: globalThis.setTimeout.bind(globalThis),
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
        },
      },
    })
    const v = new Virtualizer({
      count: 10,
      estimateSize: () => 50,
      getScrollElement: () => el as any,
      scrollToFn,
      observeElementRect: () => {},
      observeElementOffset: (_inst, cb) => {
        scrollCb = cb
        cb(100, true)
        return () => {}
      },
    })
    v._willUpdate()
    v['getMeasurements']()
    scrollToFn.mockClear()

    v.resizeItem(0, 100)

    // User pulls past the bottom: scrollTop becomes 350 (> max 300).
    el.scrollTop = 350
    scrollCb!(350, false)
    expect(scrollToFn).not.toHaveBeenCalled()

    // Bounce-back resolves
    el.scrollTop = 300
    scrollCb!(300, false)
    expect(scrollToFn).toHaveBeenCalled()
  })
})

test('Phase 2b: in-bounds flush proceeds normally (no regression)', () => {
  withFakeIOSUserAgent(() => {
    const scrollToFn = vi.fn()
    let scrollCb: ((o: number, s: boolean) => void) | null = null
    const el = makeMockScrollElement({
      scrollTop: 100,
      scrollLeft: 0,
      scrollHeight: 500,
      clientHeight: 200,
      offsetHeight: 200,
      ownerDocument: {
        defaultView: {
          setTimeout: globalThis.setTimeout.bind(globalThis),
          clearTimeout: globalThis.clearTimeout.bind(globalThis),
        },
      },
    })
    const v = new Virtualizer({
      count: 10,
      estimateSize: () => 50,
      getScrollElement: () => el as any,
      scrollToFn,
      observeElementRect: () => {},
      observeElementOffset: (_inst, cb) => {
        scrollCb = cb
        cb(100, true)
        return () => {}
      },
    })
    v._willUpdate()
    v['getMeasurements']()
    scrollToFn.mockClear()

    v.resizeItem(0, 100)
    el.scrollTop = 150
    scrollCb!(150, false) // in-bounds (0..300)
    expect(scrollToFn).toHaveBeenCalledTimes(1)
    expect(v['_iosDeferredAdjustment']).toBe(0)
  })
})

test('Phase 2a: a second self-write replaces the intended target', () => {
  let scrollCallback: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 0,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
        scrollTo: vi.fn(),
      }) as any,
    scrollToFn: vi.fn(),
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCallback = cb
      cb(0, false)
      return () => {}
    },
  })
  v._willUpdate()
  v.scrollToOffset(100, { behavior: 'auto' })
  v.scrollToOffset(200.7, { behavior: 'auto' })
  expect(v['_intendedScrollOffset']).toBe(200.7)
  // First scrollTo's offset (100) was overwritten — a scroll event near it
  // would NOT reconcile.
  scrollCallback!(101, true)
  // 101 is not within 1.5px of 200.7, so browser value wins.
  expect(v.scrollOffset).toBe(101)
})

test('iOS Phase 1: non-iOS still does NOT install touch state machine', () => {
  // On non-iOS, touchend should not arm the grace timer.
  _resetIOSDetectionForTests()
  const scrollToFn = vi.fn()
  const mockWindow = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  }
  const { v, el } = makeIOSVirtualizerWithRealEl(scrollToFn, mockWindow)

  dispatchTouchEvent(el, 'touchstart')
  expect(v['_iosTouching']).toBe(true) // touchstart still flips the flag (cheap)
  dispatchTouchEvent(el, 'touchend')
  // Non-iOS path returns before setting justTouchEnded / arming timer
  expect(v['_iosJustTouchEnded']).toBe(false)
  expect(v['_iosTouchEndTimerId']).toBeNull()
})

test('non-iOS: adjustment is applied immediately during scroll (no regression)', () => {
  // Without the iOS user-agent, the normal flow should run unchanged.
  _resetIOSDetectionForTests()
  const scrollToFn = vi.fn()
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 100,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      cb(100, true)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  scrollToFn.mockClear()

  v.resizeItem(0, 100)

  // Should have fired immediately
  expect(scrollToFn).toHaveBeenCalled()
  expect(v['_iosDeferredAdjustment']).toBe(0)
})

test('scroll-up jank: backward-scroll skips adjustment on re-measurement by default', () => {
  // Default behavior: when an already-measured above-viewport item resizes
  // AGAIN while the user is scrolling BACKWARD, we no longer write to
  // scrollTop. This avoids the well-known "items jump while scrolling up" jank.
  const scrollToFn = vi.fn()
  let scrollCb: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 200,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCb = cb
      // Simulate user starting at scrollTop=200, then scrolling up to 100.
      cb(200, false)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  // Seed item 0's size so the backward resize below is a RE-measurement.
  v.resizeItem(0, 80)
  // Now simulate backward scroll: from 200 to 100 (offset decreases).
  scrollCb!(100, true)
  expect(v.scrollDirection).toBe('backward')
  scrollToFn.mockClear()

  // Re-measure an above-viewport item while scrolling backward.
  v.resizeItem(0, 100) // item 0 grows by 20px

  // Default behavior: no scroll-position adjustment fires for re-measurements.
  expect(scrollToFn).not.toHaveBeenCalled()
})

test('scroll-up jank: backward-scroll still applies adjustment on first measurement', () => {
  // First measurement is special: the item was rendered at its estimate and is
  // now reporting its actual size. That estimate→actual delta lives above the
  // viewport and MUST be compensated, or the anchored content jumps when
  // scrolling up into never-measured rows.
  const scrollToFn = vi.fn()
  let scrollCb: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 200,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCb = cb
      cb(200, false)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  // Backward scroll: 200 → 100.
  scrollCb!(100, true)
  expect(v.scrollDirection).toBe('backward')
  scrollToFn.mockClear()

  // First measurement of an above-viewport item while scrolling backward.
  v.resizeItem(0, 100) // never measured before → estimate(50)→actual(100)

  // Adjustment still fires for the first measurement.
  expect(scrollToFn).toHaveBeenCalled()
})

test('scroll-up jank: forward-scroll still applies adjustment (no regression)', () => {
  const scrollToFn = vi.fn()
  let scrollCb: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 100,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      scrollCb = cb
      cb(100, false)
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  // Forward scroll: 100 → 200
  scrollCb!(200, true)
  expect(v.scrollDirection).toBe('forward')
  scrollToFn.mockClear()

  v.resizeItem(0, 100)

  // Forward scroll: adjustment still fires.
  expect(scrollToFn).toHaveBeenCalled()
})

test('scroll-up jank: idle (scrollDirection=null) still applies adjustment', () => {
  // When not actively scrolling, adjustment still fires — needed for the
  // mount-time measurement storm where items measure before any scroll.
  const scrollToFn = vi.fn()
  const v = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: 100,
        scrollLeft: 0,
        scrollHeight: 500,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    observeElementRect: () => {},
    observeElementOffset: (_inst, cb) => {
      cb(100, false) // not scrolling
      return () => {}
    },
  })
  v._willUpdate()
  v['getMeasurements']()
  expect(v.scrollDirection).toBeNull()
  scrollToFn.mockClear()

  v.resizeItem(0, 100)
  expect(scrollToFn).toHaveBeenCalled()
})

// ─── scroll direction vs. self-write read-backs ─────────────────────────────
//
// `applyScrollAdjustment` folds the pending adjustment into `scrollOffset`
// eagerly, so the browser's scroll event for our own `scrollTop` write
// arrives at exactly the offset we already hold (directly, or snapped there
// by the `_intendedScrollOffset` sub-pixel reconciliation). That equality
// carries no directional information — it must not be classified as a
// `'backward'` gesture, or the default
// `shouldAdjustScrollPositionOnItemSizeChange` skips above-viewport
// compensation for the whole `isScrollingResetDelay` window (see the
// multi-frame reflow test below).

function createAdjustmentVirtualizer({
  count = 30,
  offset,
}: {
  count?: number
  offset: number
}) {
  const scrollToFn = vi.fn()
  let scrollCb: ((o: number, s: boolean) => void) | null = null
  const v = new Virtualizer({
    count,
    estimateSize: () => 50,
    getScrollElement: () =>
      ({
        scrollTop: offset,
        scrollLeft: 0,
        scrollHeight: count * 50,
        clientHeight: 200,
        offsetHeight: 200,
      }) as any,
    scrollToFn,
    observeElementRect: (_inst: any, cb: any) => {
      cb({ width: 400, height: 200 })
      return () => {}
    },
    observeElementOffset: (_inst: any, cb: any) => {
      scrollCb = cb
      cb(offset, false)
      return () => {}
    },
  })
  v._didMount()
  v._willUpdate()
  v['getMeasurements']()
  scrollToFn.mockClear()
  return {
    v,
    scrollToFn,
    emitScroll: (o: number, isScrolling: boolean) => scrollCb!(o, isScrolling),
  }
}

test('self-write read-back of a positive adjustment does not latch a scroll direction', () => {
  const { v, scrollToFn, emitScroll } = createAdjustmentVirtualizer({
    offset: 600,
  })

  v['applyScrollAdjustment'](40)
  expect(scrollToFn).toHaveBeenCalledTimes(1)
  // The adjustment is already folded into `scrollOffset`.
  expect(v.scrollOffset).toBe(640)

  // Browser read-back of our own write: a scroll event at exactly the
  // offset we already hold.
  emitScroll(640, true)

  // The event traversed the listener (not swallowed by a no-op guard)...
  expect(v.isScrolling).toBe(true)
  // ...but an echo of our own write carries no direction information.
  expect(v.scrollDirection).toBeNull()
})

test('self-write read-back of a negative adjustment does not latch a scroll direction', () => {
  const { v, emitScroll } = createAdjustmentVirtualizer({ offset: 600 })

  v['applyScrollAdjustment'](-40)
  expect(v.scrollOffset).toBe(560)

  emitScroll(560, true)

  expect(v.isScrolling).toBe(true)
  expect(v.scrollDirection).toBeNull()
})

test('self-write read-back rounded by the browser still does not latch a direction', () => {
  const { v, emitScroll } = createAdjustmentVirtualizer({ offset: 600 })

  v['applyScrollAdjustment'](40.5)
  expect(v.scrollOffset).toBe(640.5)

  // The browser rounds the write to an integer; the `_intendedScrollOffset`
  // reconciliation snaps the read-back to the held value.
  emitScroll(640, true)

  expect(v.isScrolling).toBe(true)
  expect(v.scrollDirection).toBeNull()
  expect(v.scrollOffset).toBe(640.5)
})

test('real scroll gestures still latch forward/backward and reset to null', () => {
  const { v, emitScroll } = createAdjustmentVirtualizer({ offset: 600 })

  emitScroll(650, true)
  expect(v.scrollDirection).toBe('forward')
  emitScroll(700, true)
  expect(v.scrollDirection).toBe('forward')

  emitScroll(620, true)
  expect(v.scrollDirection).toBe('backward')
  emitScroll(540, true)
  expect(v.scrollDirection).toBe('backward')

  // Debounced reset emission after the gesture ends.
  emitScroll(540, false)
  expect(v.scrollDirection).toBeNull()
  expect(v.isScrolling).toBe(false)
})

test('adjustment read-back during a real backward gesture preserves the direction', () => {
  const { v, emitScroll } = createAdjustmentVirtualizer({ offset: 600 })

  // Real backward gesture: the user is scrolling up.
  emitScroll(500, true)
  expect(v.scrollDirection).toBe('backward')

  // A compensation write lands mid-gesture; its read-back arrives at
  // exactly the held offset. The user is still scrolling up, so the
  // direction must survive, not be erased.
  v['applyScrollAdjustment'](30)
  expect(v.scrollOffset).toBe(530)
  emitScroll(530, true)

  expect(v.isScrolling).toBe(true)
  expect(v.scrollDirection).toBe('backward')

  // After the reset emission, a fresh adjustment read-back must yield
  // null — not a stale 'backward' from before the reset.
  emitScroll(530, false)
  expect(v.scrollDirection).toBeNull()

  v['applyScrollAdjustment'](30)
  expect(v.scrollOffset).toBe(560)
  emitScroll(560, true)
  expect(v.isScrolling).toBe(true)
  expect(v.scrollDirection).toBeNull()
})

test('multi-frame reflow: above-viewport re-measure compensation is never skipped by self-write read-backs', () => {
  // The end-to-end shape of the bug, with the DEFAULT
  // shouldAdjustScrollPositionOnItemSizeChange: a side pane opens and its
  // width animation re-wraps rows for several frames while the user sits
  // scrolled up. Each frame re-measures above-viewport rows; the browser
  // echoes the compensation write back as a scroll event before the next
  // frame's ResizeObserver callbacks (scroll fires before RO in the
  // rendering steps). If that echo latches 'backward', every later frame's
  // re-measure is skipped until the isScrollingResetDelay reset and the
  // viewport drifts.
  const { v, scrollToFn, emitScroll } = createAdjustmentVirtualizer({
    offset: 600,
  })

  // Pre-measure the rows we'll re-wrap so they're in itemSizeCache — the
  // backward-skip leg of the default predicate only applies to re-measures.
  for (let i = 0; i < 5; i++) {
    v.resizeItem(i, 55)
    v['getMeasurements']()
  }
  // 5 first measurements × +5 each were compensated and folded.
  expect(v.scrollOffset).toBe(625)
  // Settle: the browser caught up and the scrolling window expired.
  emitScroll(625, false)
  expect(v.isScrolling).toBe(false)
  expect(v.scrollDirection).toBeNull()
  scrollToFn.mockClear()

  // The reflow: 5 frames, each re-measures one above-viewport row +20px,
  // then the browser delivers the scroll event for the compensation write
  // the way it would between frames.
  for (let i = 0; i < 5; i++) {
    const before = v.scrollOffset!
    v.resizeItem(i, 75)
    v['getMeasurements']()
    if (v.scrollOffset! !== before) {
      // A compensation write happened — deliver its read-back.
      emitScroll(v.scrollOffset!, true)
    }
  }

  // Every frame's above-viewport delta must have been compensated:
  // 625 + 5 × 20 = 725. If the first frame's read-back latched 'backward',
  // frames 2-5 were skipped and the offset is stuck at 645.
  expect(scrollToFn).toHaveBeenCalledTimes(5)
  expect(v.scrollOffset).toBe(725)
})

// ─── end anchoring / chat-style reverse virtualization ──────────────────────

function createChatVirtualizer({
  messages,
  offset,
  viewportSize = 200,
  itemSize = 50,
  followOnAppend = false,
  threshold = 1,
}: {
  messages: Array<{ id: string }>
  offset: number
  viewportSize?: number
  itemSize?: number
  followOnAppend?: boolean | 'auto' | 'smooth' | 'instant'
  threshold?: number
}) {
  let currentMessages = messages
  const scrollToFn = vi.fn()
  const scrollElement = {
    scrollTop: offset,
    scrollLeft: 0,
    scrollHeight: messages.length * itemSize,
    scrollWidth: 1000,
    clientHeight: viewportSize,
    clientWidth: 400,
    offsetHeight: viewportSize,
    ownerDocument: {
      defaultView: {
        requestAnimationFrame: (_cb: FrameRequestCallback) => {
          return 1
        },
        cancelAnimationFrame: vi.fn(),
        performance: { now: () => Date.now() },
        ResizeObserver: vi.fn(function () {
          return {
            observe: vi.fn(),
            unobserve: vi.fn(),
            disconnect: vi.fn(),
          }
        }),
      },
    },
  } as unknown as HTMLDivElement

  const makeOptions = () => {
    const messagesSnapshot = currentMessages

    return {
      count: messagesSnapshot.length,
      estimateSize: () => itemSize,
      getItemKey: (index: number) => messagesSnapshot[index]!.id,
      getScrollElement: () => scrollElement,
      scrollToFn,
      observeElementRect: (
        _instance: any,
        cb: (rect: { width: number; height: number }) => void,
      ) => {
        cb({ width: 400, height: viewportSize })
        return () => {}
      },
      observeElementOffset: (
        _instance: any,
        cb: (offset: number, isScrolling: boolean) => void,
      ) => {
        cb(scrollElement.scrollTop, false)
        return () => {}
      },
      anchorTo: 'end' as const,
      followOnAppend,
      scrollEndThreshold: threshold,
    }
  }

  const virtualizer = new Virtualizer(makeOptions())
  virtualizer._willUpdate()
  virtualizer['getMeasurements']()
  scrollToFn.mockClear()

  return {
    virtualizer,
    scrollElement,
    scrollToFn,
    setMessages(nextMessages: Array<{ id: string }>) {
      currentMessages = nextMessages
      virtualizer.setOptions(makeOptions())
      ;(scrollElement as any).scrollHeight = nextMessages.length * itemSize
      virtualizer._willUpdate()
    },
  }
}

test('anchorTo:end keeps visible content stable when older items are prepended', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { setMessages, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 100,
  })

  setMessages([{ id: 'm--2' }, { id: 'm--1' }, ...messages])

  expect(scrollToFn).toHaveBeenCalledTimes(1)
  const [offset, options] = scrollToFn.mock.calls[0]!
  expect(offset).toBe(200)
  expect(options.adjustments).toBeUndefined()
})

test('anchorTo:end does not yank a scrolled-up user when items append', () => {
  const messages = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}` }))
  const { setMessages, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 100,
    followOnAppend: true,
  })

  setMessages([...messages, { id: 'm-8' }])

  expect(scrollToFn).not.toHaveBeenCalled()
})

test('followOnAppend keeps an end-pinned user at the end when items append', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { setMessages, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 50,
    followOnAppend: true,
  })

  setMessages([...messages, { id: 'm-5' }])

  expect(scrollToFn).toHaveBeenCalledTimes(1)
  const [offset, options] = scrollToFn.mock.calls[0]!
  expect(offset).toBe(100)
  expect(options.behavior).toBe('auto')
})

test('followOnAppend accepts smooth behavior', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { setMessages, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 50,
    followOnAppend: 'smooth',
  })

  setMessages([...messages, { id: 'm-5' }])

  expect(scrollToFn).toHaveBeenCalledTimes(1)
  expect(scrollToFn.mock.calls[0]![1].behavior).toBe('smooth')
})

test('anchorTo:end keeps a pinned streaming message pinned as it grows', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollElement, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 50,
  })

  ;(scrollElement as any).scrollHeight = 320
  virtualizer.resizeItem(4, 120)

  expect(scrollToFn).toHaveBeenCalledTimes(1)
  const [offset, options] = scrollToFn.mock.calls[0]!
  expect(offset).toBe(50)
  expect(options.adjustments).toBe(70)
})

test('anchorTo:end stays pinned across consecutive resizes when the scrollTop write is clamped', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 50,
  })

  // First growth tick. The DOM `scrollTop` write may be clamped because the
  // consumer hasn't grown the sizer yet (`notify()` runs after the
  // adjustment in `resizeItem`), so no scroll event fires — `scrollToFn`
  // here is a no-op mock, mirroring that.
  virtualizer.resizeItem(4, 120)
  expect(scrollToFn).toHaveBeenCalledTimes(1)
  expect(scrollToFn.mock.calls[0]![1].adjustments).toBe(70)
  scrollToFn.mockClear()

  // Second growth tick with no scroll event in between. Before the fix,
  // `getVirtualDistanceFromEnd()` would compute against the stale
  // `scrollOffset` (50) and a grown `getTotalSize()` (320), conclude we had
  // drifted 70 px from the end (> `scrollEndThreshold: 1`), and skip the
  // adjustment — drifting forever from tick 2 onward.
  virtualizer.resizeItem(4, 200)
  expect(scrollToFn).toHaveBeenCalledTimes(1)
  expect(scrollToFn.mock.calls[0]![0]).toBe(120)
  expect(scrollToFn.mock.calls[0]![1].adjustments).toBe(80)
})

test('anchorTo:end does not follow streaming growth when user is away from end', () => {
  const messages = Array.from({ length: 8 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer, scrollToFn } = createChatVirtualizer({
    messages,
    offset: 50,
  })

  virtualizer.resizeItem(7, 120)

  expect(scrollToFn).not.toHaveBeenCalled()
})

test('isAtEnd and getDistanceFromEnd use the scroll element max offset', () => {
  const messages = Array.from({ length: 5 }, (_, i) => ({ id: `m-${i}` }))
  const { virtualizer } = createChatVirtualizer({
    messages,
    offset: 40,
    threshold: 15,
  })

  expect(virtualizer.getDistanceFromEnd()).toBe(10)
  expect(virtualizer.isAtEnd()).toBe(true)
  expect(virtualizer.isAtEnd(5)).toBe(false)
})

test('takeSnapshot: returns measured items only, restorable via initialMeasurementsCache', () => {
  const v1 = new Virtualizer({
    count: 20,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  v1['getMeasurements']()

  // No measurements yet → empty snapshot
  expect(v1.takeSnapshot()).toEqual([])

  // Measure a few items
  v1.resizeItem(0, 80)
  v1.resizeItem(1, 60)
  v1.resizeItem(2, 100)

  const snapshot = v1.takeSnapshot()
  expect(snapshot.length).toBe(3)
  expect(snapshot[0]!.size).toBe(80)
  expect(snapshot[1]!.size).toBe(60)
  expect(snapshot[2]!.size).toBe(100)
  // snapshot entries are plain objects (not Proxy refs)
  expect(Object.keys(snapshot[0]!).sort()).toEqual([
    'end',
    'index',
    'key',
    'lane',
    'size',
    'start',
  ])

  // Restore: pass snapshot to a fresh virtualizer
  const v2 = new Virtualizer({
    count: 20,
    estimateSize: () => 50,
    initialMeasurementsCache: snapshot,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m2 = v2['getMeasurements']()
  // Restored sizes match the snapshot
  expect(m2[0]!.size).toBe(80)
  expect(m2[1]!.size).toBe(60)
  expect(m2[2]!.size).toBe(100)
  // Unmeasured items fall back to estimateSize
  expect(m2[5]!.size).toBe(50)
})

test('takeSnapshot: works with lanes>1 too', () => {
  const v = new Virtualizer({
    count: 6,
    lanes: 2,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  v['getMeasurements']()
  v.resizeItem(0, 80)
  v.resizeItem(1, 90)
  const snap = v.takeSnapshot()
  expect(snap.length).toBe(2)
  expect(snap[0]!.size).toBe(80)
  expect(snap[1]!.size).toBe(90)
})

test('reconcileScroll: smooth scroll retargets remain smooth while distance > viewport', () => {
  // When target drifts during a smooth scroll (because newly visible items
  // measured in and shifted positions), the prior behavior snapped to
  // behavior:'auto' on the first retarget. New behavior: keep smooth while
  // we're still more than a viewport away, snap only on final approach.
  const { rafCallbacks, mockScrollElement, scrollToFn } =
    createMockEnvironment()
  const virtualizer = new Virtualizer({
    count: 10000,
    estimateSize: () => 50,
    getScrollElement: () => mockScrollElement,
    scrollToFn,
    observeElementRect: (_inst, cb) => {
      cb({ width: 400, height: 600 })
      return () => {}
    },
    observeElementOffset: (_inst, cb) => {
      cb(0, false)
      return () => {}
    },
  })
  virtualizer._willUpdate()
  scrollToFn.mockClear()

  virtualizer.scrollToIndex(5000, { behavior: 'smooth' })
  // First call: smooth, with our best estimate target
  const firstCall = scrollToFn.mock.calls[0]
  expect(firstCall![1].behavior).toBe('smooth')

  // Simulate a measurement that moved the target. Force resizeItem at a
  // visible-enough position so getOffsetForIndex(5000) returns a different
  // value than what scrollState.lastTargetOffset has.
  virtualizer.resizeItem(0, 80)

  // Now trigger the reconcile RAF
  rafCallbacks.forEach((cb) => cb(0))

  // The reconcile retarget should be smooth (we're far from target).
  const lastCall = scrollToFn.mock.calls[scrollToFn.mock.calls.length - 1]
  expect(lastCall![1].behavior).toBe('smooth')
})

test('lazy fast path: lanes>1 still uses eager path (regression guard)', () => {
  const v = new Virtualizer({
    count: 10,
    lanes: 2,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
  })
  const m = v['getMeasurements']()
  // Eager array, so m is a real Array; both lanes present
  const lanes = new Set(m.map((x) => x.lane))
  expect(lanes.has(0)).toBe(true)
  expect(lanes.has(1)).toBe(true)
})

test('setOptions: explicit value overrides default', () => {
  const virtualizer = new Virtualizer({
    count: 10,
    estimateSize: () => 50,
    getScrollElement: () => null,
    scrollToFn: vi.fn(),
    observeElementRect: vi.fn(),
    observeElementOffset: vi.fn(),
    overscan: 7,
    gap: 12,
    lanes: 3,
  })

  expect(virtualizer.options.overscan).toBe(7)
  expect(virtualizer.options.gap).toBe(12)
  expect(virtualizer.options.lanes).toBe(3)
})

// ─── elementScroll / windowScroll public exports ─────────────────────────────

function makeBaseInstance(scrollEl: any, opts: any = {}) {
  return {
    scrollElement: scrollEl,
    options: {
      horizontal: false,
      ...opts,
    },
  } as any
}

test('elementScroll: calls scrollTo with top + behavior on the scroll element', () => {
  const scrollTo = vi.fn()
  const scrollEl = { scrollTo }
  elementScroll(100, { behavior: 'smooth' }, makeBaseInstance(scrollEl) as any)
  expect(scrollTo).toHaveBeenCalledWith({ top: 100, behavior: 'smooth' })
})

test('elementScroll: applies adjustments offset', () => {
  const scrollTo = vi.fn()
  const scrollEl = { scrollTo }
  elementScroll(
    100,
    { adjustments: 50, behavior: 'auto' },
    makeBaseInstance(scrollEl) as any,
  )
  expect(scrollTo).toHaveBeenCalledWith({ top: 150, behavior: 'auto' })
})

test('elementScroll: uses left when horizontal is true', () => {
  const scrollTo = vi.fn()
  const scrollEl = { scrollTo }
  elementScroll(
    100,
    { behavior: 'auto' },
    makeBaseInstance(scrollEl, { horizontal: true }) as any,
  )
  expect(scrollTo).toHaveBeenCalledWith({ left: 100, behavior: 'auto' })
})

test('windowScroll: calls scrollTo with top + behavior on the window', () => {
  const scrollTo = vi.fn()
  const win = { scrollTo }
  windowScroll(250, { behavior: 'smooth' }, makeBaseInstance(win) as any)
  expect(scrollTo).toHaveBeenCalledWith({ top: 250, behavior: 'smooth' })
})

test('windowScroll: applies adjustments + horizontal', () => {
  const scrollTo = vi.fn()
  const win = { scrollTo }
  windowScroll(
    250,
    { adjustments: -10, behavior: 'auto' },
    makeBaseInstance(win, { horizontal: true }) as any,
  )
  expect(scrollTo).toHaveBeenCalledWith({ left: 240, behavior: 'auto' })
})

test('elementScroll / windowScroll: no-op when scrollElement is null', () => {
  expect(() =>
    elementScroll(100, {}, makeBaseInstance(null) as any),
  ).not.toThrow()
  expect(() =>
    windowScroll(100, {}, makeBaseInstance(null) as any),
  ).not.toThrow()
})

// ─── observeElementOffset / observeWindowOffset ──────────────────────────────

function makeObserveInstance(
  element: any,
  opts: {
    horizontal?: boolean
    isRtl?: boolean
    useScrollendEvent?: boolean
    isScrollingResetDelay?: number
  } = {},
  targetWindow: any = {
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  },
) {
  return {
    scrollElement: element,
    targetWindow,
    options: {
      horizontal: false,
      isRtl: false,
      useScrollendEvent: false,
      isScrollingResetDelay: 150,
      ...opts,
    },
  } as any
}

test('observeElementOffset: returns undefined when scrollElement is null', () => {
  const cb = vi.fn()
  expect(
    observeElementOffset(makeObserveInstance(null) as any, cb),
  ).toBeUndefined()
  expect(cb).not.toHaveBeenCalled()
})

test('observeElementOffset: attaches scroll listener and fires callback with scrollTop', () => {
  const cb = vi.fn()
  const listeners = new Map<string, EventListener>()
  const el: any = {
    scrollTop: 50,
    scrollLeft: 0,
    addEventListener: (name: string, fn: any) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  }
  const cleanup = observeElementOffset(makeObserveInstance(el) as any, cb)
  expect(listeners.has('scroll')).toBe(true)
  // No scrollend listener by default
  expect(listeners.has('scrollend')).toBe(false)
  // Trigger scroll
  listeners.get('scroll')!({} as Event)
  expect(cb).toHaveBeenCalledWith(50, true)
  cleanup?.()
  expect(listeners.has('scroll')).toBe(false)
})

test('observeElementOffset: reads scrollLeft + applies isRtl when horizontal', () => {
  const cb = vi.fn()
  const listeners = new Map<string, EventListener>()
  const el: any = {
    scrollTop: 0,
    scrollLeft: 80,
    addEventListener: (name: string, fn: any) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  }
  observeElementOffset(
    makeObserveInstance(el, { horizontal: true, isRtl: true }) as any,
    cb,
  )
  listeners.get('scroll')!({} as Event)
  // isRtl flips sign
  expect(cb).toHaveBeenCalledWith(-80, true)
})

test('observeWindowOffset: returns undefined when scrollElement is null', () => {
  const cb = vi.fn()
  expect(
    observeWindowOffset(makeObserveInstance(null) as any, cb),
  ).toBeUndefined()
})

test('observeWindowOffset: attaches scroll listener and fires callback with scrollY', () => {
  const cb = vi.fn()
  const listeners = new Map<string, EventListener>()
  const win: any = {
    scrollX: 0,
    scrollY: 120,
    addEventListener: (name: string, fn: any) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  }
  const cleanup = observeWindowOffset(makeObserveInstance(win) as any, cb)
  expect(listeners.has('scroll')).toBe(true)
  listeners.get('scroll')!({} as Event)
  expect(cb).toHaveBeenCalledWith(120, true)
  cleanup?.()
  expect(listeners.has('scroll')).toBe(false)
})

// ─── Public-exports lockdown ─────────────────────────────────────────────────
// If any of these go missing the next minor bump silently breaks consumers.

test('public runtime exports from @tanstack/virtual-core', async () => {
  const mod = await import('../src/index')
  // Class + helpers
  expect(typeof mod.Virtualizer).toBe('function')
  expect(typeof mod.defaultKeyExtractor).toBe('function')
  expect(typeof mod.defaultRangeExtractor).toBe('function')
  // Observers
  expect(typeof mod.observeElementRect).toBe('function')
  expect(typeof mod.observeWindowRect).toBe('function')
  expect(typeof mod.observeElementOffset).toBe('function')
  expect(typeof mod.observeWindowOffset).toBe('function')
  // Scrollers
  expect(typeof mod.elementScroll).toBe('function')
  expect(typeof mod.windowScroll).toBe('function')
  // Measurement
  expect(typeof mod.measureElement).toBe('function')
  // Utilities (historically re-exported from utils)
  expect(typeof mod.memo).toBe('function')
  expect(typeof mod.debounce).toBe('function')
  expect(typeof mod.notUndefined).toBe('function')
  expect(typeof mod.approxEqual).toBe('function')
})

test('observeWindowOffset: reads scrollX when horizontal', () => {
  const cb = vi.fn()
  const listeners = new Map<string, EventListener>()
  const win: any = {
    scrollX: 75,
    scrollY: 0,
    addEventListener: (name: string, fn: any) => listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  }
  observeWindowOffset(makeObserveInstance(win, { horizontal: true }) as any, cb)
  listeners.get('scroll')!({} as Event)
  expect(cb).toHaveBeenCalledWith(75, true)
})
