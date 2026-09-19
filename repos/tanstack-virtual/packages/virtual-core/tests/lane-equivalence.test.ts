// Differential ("oracle") test for the multi-lane lane-assignment optimization.
//
// The old code placed an uncached item by scanning `measurements` backward for
// the shortest lane's furthest item; that scan is now an O(lanes) argmin over a
// running `laneEnds` array. The reference below is a verbatim port of the *old*
// algorithm (not a reuse of the real source — that would be tautological), and
// each test compares the real Virtualizer against it. Verify the port by
// diffing against its origin at commit 850947a4:
//   getFurthestMeasurement (backward scan): src/index.ts#L1085
//   getMeasurements placement loop:         src/index.ts#L1278
//   https://github.com/TanStack/virtual/blob/850947a42dc322ac1dd0328a15ed344763932b60/packages/virtual-core/src/index.ts

import { describe, expect, it, vi } from 'vitest'
import { Virtualizer } from '../src/index'

type RefItem = {
  index: number
  start: number
  size: number
  end: number
  lane: number
}

// Removed Virtualizer.getFurthestMeasurement, ported verbatim: the shortest
// lane's furthest item (tie-break end, then index), or undefined until every
// lane has been seen.
function getFurthestMeasurement(
  measurements: Array<RefItem>,
  index: number,
  lanes: number,
) {
  const found = new Map<number, true>()
  const furthest = new Map<number, RefItem>()
  for (let m = index - 1; m >= 0; m--) {
    const meas = measurements[m]!
    if (found.has(meas.lane)) continue
    const prev = furthest.get(meas.lane)
    if (prev == null || meas.end > prev.end) {
      furthest.set(meas.lane, meas)
    } else if (meas.end < prev.end) {
      found.set(meas.lane, true)
    }
    if (found.size === lanes) break
  }
  return furthest.size === lanes
    ? Array.from(furthest.values()).sort((a, b) =>
        a.end === b.end ? a.index - b.index : a.end - b.end,
      )[0]
    : undefined
}

// Deterministic LCG so failures reproduce.
function makeRng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

// Verbatim port of the old getMeasurements placement loop (lanes > 1). Without
// resizeItem() it is a plain fresh build (argmin path); with resizeItem() it
// also covers incremental rebuilds (min > 0, prefix seeding) and cached/uncached
// mixing. Caches key by index, matching the real Virtualizer's default key.
class ReferenceVirtualizer {
  private measurements: Array<RefItem> = []
  private itemSizeCache = new Map<number, number>()
  private laneAssignments = new Map<number, number>()
  private pendingMin: number | null = null

  constructor(
    private opts: {
      count: number
      lanes: number
      gap: number
      paddingStart: number
      scrollMargin: number
      laneAssignmentMode: 'estimate' | 'measured'
      estimateSize: (i: number) => number
    },
  ) {}

  // Mirrors Virtualizer.resizeItem: on a real delta, dirty pendingMin and
  // record the measured size.
  resizeItem(index: number, size: number) {
    const item = this.measurements[index]
    if (!item) return
    const itemSize = this.itemSizeCache.get(index) ?? item.size
    if (size === itemSize) return
    if (this.pendingMin === null || index < this.pendingMin) {
      this.pendingMin = index
    }
    this.itemSizeCache.set(index, size)
  }

  build() {
    const {
      count,
      lanes,
      gap,
      paddingStart,
      scrollMargin,
      laneAssignmentMode,
      estimateSize,
    } = this.opts
    const min = this.pendingMin ?? 0
    this.pendingMin = null
    const measurements = this.measurements.slice(0, min)

    // Seed per-lane last-item index from the retained prefix (before min).
    const laneLastIndex: Array<number | undefined> = new Array(lanes).fill(
      undefined,
    )
    for (let m = 0; m < min; m++) {
      const item = measurements[m]
      if (item) laneLastIndex[item.lane] = m
    }

    for (let i = min; i < count; i++) {
      const cachedLane = this.laneAssignments.get(i)
      let lane: number
      let start: number

      const shouldCacheLane =
        laneAssignmentMode === 'estimate' || this.itemSizeCache.has(i)

      if (cachedLane !== undefined && lanes > 1) {
        // Cached lane: O(1) continue from the lane's previous item.
        lane = cachedLane
        const prevIndex = laneLastIndex[lane]
        const prevInLane =
          prevIndex !== undefined ? measurements[prevIndex] : undefined
        start = prevInLane ? prevInLane.end + gap : paddingStart + scrollMargin
      } else {
        // No cache: find the shortest lane via the backward scan.
        const furthest =
          lanes === 1
            ? measurements[i - 1]
            : getFurthestMeasurement(measurements, i, lanes)
        start = furthest ? furthest.end + gap : paddingStart + scrollMargin
        lane = furthest ? furthest.lane : i % lanes
        if (lanes > 1 && shouldCacheLane) {
          this.laneAssignments.set(i, lane)
        }
      }

      const measuredSize = this.itemSizeCache.get(i)
      const size =
        typeof measuredSize === 'number' ? measuredSize : estimateSize(i)
      const end = start + size
      measurements[i] = { index: i, start, size, end, lane }
      laneLastIndex[lane] = i
    }

    this.measurements = measurements
    return measurements
  }
}

describe('multi-lane placement equivalence with the original backward scan', () => {
  const laneCounts = [2, 3, 4, 5, 8]

  for (const lanes of laneCounts) {
    it(`matches reference for lanes=${lanes} across random size distributions`, () => {
      for (let seed = 1; seed <= 20; seed++) {
        const rng = makeRng(seed * 7919 + lanes)
        const count = 200 + Math.floor(rng() * 800)
        const gap = Math.floor(rng() * 12) // 0..11
        const paddingStart = Math.floor(rng() * 40)
        const scrollMargin = Math.floor(rng() * 40)
        // Varied sizes so lanes diverge and tie-breaks actually get exercised;
        // occasional equal sizes to force `end` ties.
        const sizes = Array.from({ length: count }, () =>
          rng() < 0.25 ? 30 : 10 + Math.floor(rng() * 100),
        )
        const sizeOf = (i: number) => sizes[i]!

        // Fresh build (no resizeItem): drives the shortest-lane argmin at
        // min = 0. The cached-lane branch stays dormant here (a cache written
        // this build is only read on a later one) — covered by the suite below.
        const expected = new ReferenceVirtualizer({
          count,
          lanes,
          gap,
          paddingStart,
          scrollMargin,
          laneAssignmentMode: 'estimate',
          estimateSize: sizeOf,
        }).build()

        const v = new Virtualizer({
          count,
          lanes,
          gap,
          paddingStart,
          scrollMargin,
          estimateSize: sizeOf,
          getScrollElement: () => null,
          scrollToFn: vi.fn(),
          observeElementRect: vi.fn(),
          observeElementOffset: vi.fn(),
        })
        const actual = (v as any).getMeasurements() as Array<any>

        expect(actual.length).toBe(expected.length)
        for (let i = 0; i < count; i++) {
          const a = actual[i]
          const e = expected[i]!
          // Compare the geometry-defining fields explicitly for a precise diff.
          expect({
            index: a.index,
            lane: a.lane,
            start: a.start,
            size: a.size,
            end: a.end,
          }).toEqual({
            index: e.index,
            lane: e.lane,
            start: e.start,
            size: e.size,
            end: e.end,
          })
        }
      }
    })
  }

  // Uniform sizes make every lane's ends equal at each row, so every
  // shortest-lane pick is an `end` tie resolved purely by the last-item-index
  // tie-break — the common same-height-grid case, and the hardest exercise of
  // that tie-break. Split out because the randomized suite above rarely yields
  // all-equal rows.
  it('matches reference for uniform sizes (every placement is an end-tie)', () => {
    for (const lanes of [2, 3, 4, 5, 8]) {
      for (const gap of [0, 4, 10]) {
        const count = 500
        const sizeOf = () => 42

        const expected = new ReferenceVirtualizer({
          count,
          lanes,
          gap,
          paddingStart: 0,
          scrollMargin: 0,
          laneAssignmentMode: 'estimate',
          estimateSize: sizeOf,
        }).build()

        const v = new Virtualizer({
          count,
          lanes,
          gap,
          estimateSize: sizeOf,
          getScrollElement: () => null,
          scrollToFn: vi.fn(),
          observeElementRect: vi.fn(),
          observeElementOffset: vi.fn(),
        })
        const actual = (v as any).getMeasurements() as Array<any>

        for (let i = 0; i < count; i++) {
          const a = actual[i]
          const e = expected[i]!
          expect(
            { lane: a.lane, start: a.start, size: a.size, end: a.end },
            `lanes=${lanes} gap=${gap} item ${i}`,
          ).toEqual({ lane: e.lane, start: e.start, size: e.size, end: e.end })
        }
      }
    }
  })
})

// `measured` mode with interleaved resizeItem() calls, covering the paths the
// fresh-build suite can't: incremental rebuilds with min > 0 (prefix seeding the
// argmin reads from) and the cached-lane branch mixing with uncached items.
describe('multi-lane placement equivalence under measured-mode rebuilds', () => {
  const laneCounts = [2, 3, 4, 5]

  for (const lanes of laneCounts) {
    it(`matches reference across resize-driven rebuilds for lanes=${lanes}`, () => {
      for (let seed = 1; seed <= 12; seed++) {
        const rng = makeRng(seed * 104729 + lanes)
        const count = 120 + Math.floor(rng() * 380)
        const gap = Math.floor(rng() * 10)
        const paddingStart = Math.floor(rng() * 30)
        const scrollMargin = Math.floor(rng() * 30)
        const estimateSize = (i: number) => 20 + ((i * 37) % 90)

        const reference = new ReferenceVirtualizer({
          count,
          lanes,
          gap,
          paddingStart,
          scrollMargin,
          laneAssignmentMode: 'measured',
          estimateSize,
        })

        const v = new Virtualizer({
          count,
          lanes,
          gap,
          paddingStart,
          scrollMargin,
          laneAssignmentMode: 'measured',
          estimateSize,
          getScrollElement: () => null,
          scrollToFn: vi.fn(),
          observeElementRect: vi.fn(),
          observeElementOffset: vi.fn(),
        })

        const assertEquivalent = (label: string) => {
          const expected = reference.build()
          const actual = (v as any).getMeasurements() as Array<any>
          expect(actual.length, `${label}: length`).toBe(expected.length)
          for (let i = 0; i < count; i++) {
            const a = actual[i]
            const e = expected[i]!
            expect(
              { lane: a.lane, start: a.start, size: a.size, end: a.end },
              `${label}: item ${i}`,
            ).toEqual({
              lane: e.lane,
              start: e.start,
              size: e.size,
              end: e.end,
            })
          }
        }

        // Initial estimate-only build (nothing measured yet).
        assertEquivalent('initial')

        // Measure a random subset, then rebuild — the min(i) dirties pendingMin
        // so rebuilds start from min > 0 and reuse the cached prefix.
        for (let round = 0; round < 4; round++) {
          const measures = 5 + Math.floor(rng() * 15)
          for (let k = 0; k < measures; k++) {
            const index = Math.floor(rng() * count)
            const size = 15 + Math.floor(rng() * 140)
            reference.resizeItem(index, size)
            ;(v as any).resizeItem(index, size)
          }
          assertEquivalent(`round ${round}`)
        }
      }
    })
  }
})
