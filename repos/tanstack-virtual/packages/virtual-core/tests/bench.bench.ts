// Real benchmarks against the actual Virtualizer class.
// Run with: cd packages/virtual-core && npx vitest bench --run
//
// Compare before/after by running this script, saving output, applying a fix,
// re-running, diffing.

import { bench, describe } from 'vitest'
import { Virtualizer, defaultRangeExtractor } from '../src/index'

function makeVirt(count: number, lanes = 1): Virtualizer<any, any> {
  const v = new Virtualizer({
    count,
    lanes,
    estimateSize: () => 30,
    getScrollElement: () => null,
    scrollToFn: () => {},
    observeElementRect: () => {},
    observeElementOffset: () => {},
  })
  // Warm getMeasurements
  ;(v as any).getMeasurements()
  return v
}

// ─── Exp 1: Cold-mount cost — getMeasurements with no measured items ─────────

describe('Exp 1: Cold mount — first getMeasurements call (no measurements)', () => {
  for (const n of [1000, 10000, 100000, 500000]) {
    bench(`n=${n}`, () => {
      const v = new Virtualizer({
        count: n,
        estimateSize: () => 30,
        getScrollElement: () => null,
        scrollToFn: () => {},
        observeElementRect: () => {},
        observeElementOffset: () => {},
      })
      ;(v as any).getMeasurements()
    })
  }
})

describe('Exp 1: Cold mount — visible-range query for visible window only', () => {
  // Realistic: mount then ask "what is at offset 0" — should not materialize
  // the whole list, only walk to ~20 items.
  for (const n of [1000, 10000, 100000, 500000]) {
    bench(`n=${n} getVirtualItemForOffset(0)`, () => {
      const v = new Virtualizer({
        count: n,
        estimateSize: () => 30,
        getScrollElement: () => null,
        scrollToFn: () => {},
        observeElementRect: () => {},
        observeElementOffset: () => {},
      })
      ;(v as any).getVirtualItemForOffset(0)
    })
  }
})

// ─── Layer 1: Map clone bug — resizeItem under measure storm ─────────────────

describe('Layer 1: resizeItem measure storm — full N resizes then 1× getMeasurements', () => {
  for (const n of [100, 1000, 5000, 10000]) {
    bench(`n=${n}`, () => {
      const v = makeVirt(n)
      for (let i = 0; i < n; i++) v.resizeItem(i, 30 + (i % 7))
      ;(v as any).getMeasurements()
    })
  }
})

describe('Layer 1: resizeItem measure storm — getMeasurements per call', () => {
  for (const n of [100, 1000, 5000]) {
    bench(`n=${n}`, () => {
      const v = makeVirt(n)
      for (let i = 0; i < n; i++) {
        v.resizeItem(i, 30 + (i % 7))
        ;(v as any).getMeasurements()
      }
    })
  }
})

describe('Layer 4: notify cost — no-op vs realistic onChange', () => {
  // Comparison: how much time does the notify call add per resizeItem?
  const N = 10000
  bench(`n=${N}, no-op onChange (lower bound)`, () => {
    const v = new Virtualizer({
      count: N,
      estimateSize: () => 30,
      getScrollElement: () => null,
      scrollToFn: () => {},
      observeElementRect: () => {},
      observeElementOffset: () => {},
    })
    ;(v as any).getMeasurements()
    for (let i = 0; i < N; i++) v.resizeItem(i, 30 + (i % 7))
  })
  bench(`n=${N}, realistic onChange (alloc per call)`, () => {
    let prev: any = null
    const v = new Virtualizer({
      count: N,
      estimateSize: () => 30,
      getScrollElement: () => null,
      scrollToFn: () => {},
      observeElementRect: () => {},
      observeElementOffset: () => {},
      onChange: () => {
        prev = {}
      },
    })
    ;(v as any).getMeasurements()
    for (let i = 0; i < N; i++) v.resizeItem(i, 30 + (i % 7))
  })
})

describe('Layer 4: onChange callbacks fired per resize-storm', () => {
  // Pre-Layer-4: resizeItem calls notify(false) on every call, even when
  // the visible range doesn't change. This benchmark counts callbacks and
  // measures cost when onChange is a non-trivial function (closer to real
  // React adapter cost than the no-op default).
  for (const n of [100, 1000, 10000]) {
    bench(`n=${n}, realistic onChange (counter + identity check)`, () => {
      let count = 0
      let prev: any = null
      const v = new Virtualizer({
        count: n,
        estimateSize: () => 30,
        getScrollElement: () => null,
        scrollToFn: () => {},
        observeElementRect: () => {},
        observeElementOffset: () => {},
        // Simulates React adapter: dispatches a "rerender" each call
        onChange: (instance) => {
          count++
          prev = { state: count } // alloc per call, like useReducer(() => ({}))
        },
      })
      ;(v as any).getMeasurements()
      for (let i = 0; i < n; i++) v.resizeItem(i, 30 + (i % 7))
    })
  }
})

describe('Layer 3: pending-min lookup under heavy storms', () => {
  // Stress the "find earliest dirty index" path. Pre-Layer-3 used
  // `Math.min(...pendingMeasuredCacheIndexes)` which spreads onto the stack.
  for (const n of [10000, 50000, 100000]) {
    bench(
      `n=${n} resizes in reverse order (worst case for running min)`,
      () => {
        const v = makeVirt(n)
        // Reverse order means every push lowers the min — exercises the
        // running-min branch on every single push.
        for (let i = n - 1; i >= 0; i--) v.resizeItem(i, 30 + (i % 7))
        ;(v as any).getMeasurements()
      },
    )
  }
})

describe('Layer 1: repeated resize at index 0', () => {
  for (const n of [1000, 10000, 50000]) {
    bench(`n=${n}, 100× resize+getMeasurements`, () => {
      const v = makeVirt(n)
      for (let i = 0; i < 100; i++) {
        v.resizeItem(0, 30 + (i % 5))
        ;(v as any).getMeasurements()
      }
    })
  }
})

// ─── Layer 2: setOptions per render ──────────────────────────────────────────

describe('Layer 2: setOptions() — simulating React render storm', () => {
  bench('setOptions × 10,000', () => {
    const v = new Virtualizer({
      count: 1000,
      estimateSize: () => 30,
      getScrollElement: () => null,
      scrollToFn: () => {},
      observeElementRect: () => {},
      observeElementOffset: () => {},
    })
    for (let i = 0; i < 10_000; i++) {
      v.setOptions({
        count: 1000,
        estimateSize: () => 30,
        getScrollElement: () => null,
        scrollToFn: () => {},
        observeElementRect: () => {},
        observeElementOffset: () => {},
        overscan: undefined as any,
        paddingStart: undefined as any,
        paddingEnd: undefined as any,
      } as any)
    }
  })
})

// ─── Scroll loop: per-scroll-frame cost (calculateRange + memo machinery) ─────

describe('Scroll loop: 10k scroll events on warm virtualizer', () => {
  for (const n of [1000, 100000]) {
    // Wrap offsets at the real max scroll so every iteration exercises a
    // representative range (not the degenerate end-of-list state once
    // i*5 exceeds totalSize - viewport).
    const maxOffset = n * 30 - 600
    bench(`n=${n}, 10k scrolls`, () => {
      const v = makeVirt(n)
      v.scrollRect = { width: 800, height: 600 }
      for (let i = 0; i < 10_000; i++) {
        v.scrollOffset = (i * 5) % maxOffset
        ;(v as any).calculateRange()
      }
    })
    bench(`n=${n}, 10k scrolls + getVirtualItems`, () => {
      const v = makeVirt(n)
      v.scrollRect = { width: 800, height: 600 }
      for (let i = 0; i < 10_000; i++) {
        v.scrollOffset = (i * 5) % maxOffset
        v.getVirtualItems()
      }
    })
  }
})

// ─── Layer 6: defaultRangeExtractor ──────────────────────────────────────────

describe('Layer 6: defaultRangeExtractor', () => {
  for (const visible of [50, 200, 1000]) {
    bench(`visible=${visible} × 10,000`, () => {
      for (let i = 0; i < 10_000; i++) {
        defaultRangeExtractor({
          startIndex: 0,
          endIndex: visible - 1,
          overscan: 5,
          count: 100_000,
        })
      }
    })
  }
})

// ─── Multi-lane: cold-mount lane assignment (getFurthestMeasurement) ──────────
// Divergent lane heights (variable estimateSize) force the backward scan in
// getFurthestMeasurement to walk further before all lanes "settle".

describe('Multi-lane cold mount: getMeasurements with variable sizes', () => {
  for (const lanes of [2, 4, 8]) {
    for (const n of [10000, 100000]) {
      bench(`lanes=${lanes} n=${n}`, () => {
        const v = new Virtualizer({
          count: n,
          lanes,
          // Variable sizes → lanes diverge → longer backward scans.
          estimateSize: (i: number) => 20 + ((i * 37) % 120),
          getScrollElement: () => null,
          scrollToFn: () => {},
          observeElementRect: () => {},
          observeElementOffset: () => {},
        })
        ;(v as any).getMeasurements()
      })
    }
  }
})

// Uniform sizes: the common same-height grid. The old backward scan settled
// quickly here (balanced lanes → shallow walk), so this isolates the flat
// constant-factor win from dropping the per-placement Map allocations + sort,
// independent of scan depth. Guards against regressing the most common case.
describe('Multi-lane cold mount: getMeasurements with uniform sizes', () => {
  for (const lanes of [2, 4, 8]) {
    for (const n of [10000, 100000]) {
      bench(`lanes=${lanes} n=${n}`, () => {
        const v = new Virtualizer({
          count: n,
          lanes,
          estimateSize: () => 50,
          getScrollElement: () => null,
          scrollToFn: () => {},
          observeElementRect: () => {},
          observeElementOffset: () => {},
        })
        ;(v as any).getMeasurements()
      })
    }
  }
})

// Worst case: 'measure' mode keeps items uncached across rebuilds, so every
// rebuild re-runs getFurthestMeasurement for the whole (unmeasured) list.
describe('Multi-lane rebuild storm: measure mode, 50× getMeasurements', () => {
  for (const lanes of [2, 4]) {
    const n = 20000
    bench(`lanes=${lanes} n=${n} ×50 rebuilds`, () => {
      const v = new Virtualizer({
        count: n,
        lanes,
        laneAssignmentMode: 'measured',
        estimateSize: (i: number) => 20 + ((i * 37) % 120),
        getScrollElement: () => null,
        scrollToFn: () => {},
        observeElementRect: () => {},
        observeElementOffset: () => {},
      })
      for (let r = 0; r < 50; r++) {
        ;(v as any).itemSizeCacheVersion++
        ;(v as any).getMeasurements()
      }
    })
  }
})
