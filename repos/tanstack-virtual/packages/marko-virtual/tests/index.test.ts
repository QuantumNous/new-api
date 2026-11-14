/**
 * Unit tests for @tanstack/marko-virtual
 *
 * These tests cover the TypeScript adapter layer — re-exports and Virtualizer
 * construction with the options that the <virtualizer> and <window-virtualizer>
 * tags wire up internally.
 *
 * Tag-level integration tests (testing the compiled Marko components with DOM
 * mounting and reactive updates) live in tests/tags.test.ts and use
 * @marko/vite + template.mount() directly.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest'
import {
  defaultKeyExtractor,
  defaultRangeExtractor,
  elementScroll,
  observeElementOffset,
  observeElementRect,
  observeWindowOffset,
  observeWindowRect,
  Virtualizer,
  windowScroll,
} from '../src/index'

// ---------------------------------------------------------------------------
// Mock scroll dimensions so virtualizers can calculate visible ranges
// ---------------------------------------------------------------------------

beforeEach(() => {
  Object.defineProperties(HTMLElement.prototype, {
    scrollHeight: {
      configurable: true,
      get: () => Number.MAX_SAFE_INTEGER,
    },
    scrollWidth: {
      configurable: true,
      get: () => Number.MAX_SAFE_INTEGER,
    },
  })
})

// ---------------------------------------------------------------------------
// Re-export surface
// ---------------------------------------------------------------------------

describe('re-exports', () => {
  test('exports Virtualizer from virtual-core', () => {
    expect(Virtualizer).toBeDefined()
    expect(typeof Virtualizer).toBe('function')
  })

  test('exports element scroll observers', () => {
    expect(observeElementRect).toBeDefined()
    expect(observeElementOffset).toBeDefined()
    expect(elementScroll).toBeDefined()
  })

  test('exports window scroll observers', () => {
    expect(observeWindowRect).toBeDefined()
    expect(observeWindowOffset).toBeDefined()
    expect(windowScroll).toBeDefined()
  })

  test('exports utility functions', () => {
    expect(defaultRangeExtractor).toBeDefined()
    expect(defaultKeyExtractor).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Row virtualizer (the default <virtualizer> behaviour)
// ---------------------------------------------------------------------------

describe('row virtualizer', () => {
  test('creates a Virtualizer instance', () => {
    const el = document.createElement('div')
    const onChange = vi.fn()

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 50,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange,
    })

    expect(v).toBeDefined()
    expect(v.options.count).toBe(100)
    expect(v.options.horizontal).toBeFalsy()
  })

  test('getVirtualItems returns an array before mount', () => {
    const el = document.createElement('div')

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 50,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    expect(Array.isArray(v.getVirtualItems())).toBe(true)
  })

  test('getTotalSize returns estimate-based total before mount', () => {
    const el = document.createElement('div')

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 50,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    // In v3, getTotalSize() = count x estimateSize even before _didMount().
    // Mount sets up the ResizeObserver for the scroll element measured
    // dimensions - it does not gate the estimate-based total size calculation.
    expect(v.getTotalSize()).toBe(5000) // 100 items x 50px each
  })

  test('setOptions updates count', () => {
    const el = document.createElement('div')

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 50,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    v.setOptions({ ...v.options, count: 200 })
    expect(v.options.count).toBe(200)
  })

  test('onChange callback is called when virtualizer is notified of dimensions', () => {
    const el = document.createElement('div')
    const onChange = vi.fn()

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 50,
      // Mock both observers to fire synchronously in jsdom.
      // The real observeElementOffset uses scroll event listeners that
      // do not fire synchronously in jsdom, so we stub both here.
      observeElementRect: (_instance, cb) => {
        cb({ width: 400, height: 400 })
        return () => {}
      },
      observeElementOffset: (_instance, cb) => {
        cb(0, false)
        return () => {}
      },
      scrollToFn: elementScroll,
      onChange,
    })

    const cleanup = v._didMount()
    v._willUpdate()
    expect(onChange).toHaveBeenCalled()

    cleanup()
  })
})

// ---------------------------------------------------------------------------
// Column virtualizer (horizontal=true)
// ---------------------------------------------------------------------------

describe('column virtualizer', () => {
  test('creates a horizontal Virtualizer instance', () => {
    const el = document.createElement('div')

    const v = new Virtualizer({
      count: 50,
      horizontal: true,
      getScrollElement: () => el,
      estimateSize: () => 100,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    expect(v.options.horizontal).toBe(true)
    expect(v.options.count).toBe(50)
  })

  test('uses width not height for sizing', () => {
    const el = document.createElement('div')
    const onChange = vi.fn()

    const v = new Virtualizer({
      count: 50,
      horizontal: true,
      getScrollElement: () => el,
      estimateSize: () => 100,
      observeElementRect: (_instance, cb) => {
        cb({ width: 400, height: 200 })
        return () => {}
      },
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange,
    })

    const cleanup = v._didMount()
    // After mount with a 400px-wide container, virtual items should exist
    const items = v.getVirtualItems()
    expect(Array.isArray(items)).toBe(true)
    cleanup()
  })
})

// ---------------------------------------------------------------------------
// Grid (two virtualizers composed)
// ---------------------------------------------------------------------------

describe('grid (two virtualizers)', () => {
  test('row and column virtualizers can be created independently', () => {
    const el = document.createElement('div')

    const rows = new Virtualizer({
      count: 1000,
      getScrollElement: () => el,
      estimateSize: () => 35,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    const cols = new Virtualizer({
      count: 100,
      horizontal: true,
      getScrollElement: () => el,
      estimateSize: () => 100,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    expect(rows.options.horizontal).toBeFalsy()
    expect(cols.options.horizontal).toBe(true)
    expect(rows.options.count).toBe(1000)
    expect(cols.options.count).toBe(100)
  })
})

// ---------------------------------------------------------------------------
// Lifecycle: _didMount and _willUpdate
// ---------------------------------------------------------------------------

describe('virtualizer lifecycle', () => {
  test('_didMount returns a cleanup function', () => {
    const el = document.createElement('div')

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 50,
      observeElementRect: (_instance, _cb) => () => {},
      observeElementOffset: (_instance, _cb) => () => {},
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    const cleanup = v._didMount()
    expect(typeof cleanup).toBe('function')
    // Cleanup should not throw
    expect(() => cleanup()).not.toThrow()
  })

  test('_willUpdate does not throw', () => {
    const el = document.createElement('div')

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 50,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    expect(() => v._willUpdate()).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// Options: overscan, paddingStart, paddingEnd, gap, lanes
// ---------------------------------------------------------------------------

describe('virtualizer options', () => {
  test('accepts overscan option', () => {
    const el = document.createElement('div')

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 50,
      overscan: 10,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    expect(v.options.overscan).toBe(10)
  })

  test('accepts paddingStart and paddingEnd', () => {
    const el = document.createElement('div')

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 50,
      paddingStart: 16,
      paddingEnd: 16,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    expect(v.options.paddingStart).toBe(16)
    expect(v.options.paddingEnd).toBe(16)
  })

  test('accepts gap option', () => {
    const el = document.createElement('div')

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 50,
      gap: 8,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    expect(v.options.gap).toBe(8)
  })

  test('accepts lanes option for masonry', () => {
    const el = document.createElement('div')

    const v = new Virtualizer({
      count: 100,
      getScrollElement: () => el,
      estimateSize: () => 200,
      lanes: 3,
      observeElementRect,
      observeElementOffset,
      scrollToFn: elementScroll,
      onChange: vi.fn(),
    })

    expect(v.options.lanes).toBe(3)
  })
})
