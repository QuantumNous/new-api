# @tanstack/virtual-core

## 3.17.3

### Patch Changes

- [#1206](https://github.com/TanStack/virtual/pull/1206) [`767ead4`](https://github.com/TanStack/virtual/commit/767ead46e4fab761fd6e15bcf281486042723152) - Cut per-scroll-frame allocations on the default `lanes === 1` path. Range computation previously allocated an options object and two closures on every scroll event; it now does the same work allocation-free, reducing GC pressure during continuous scroll.

- [#1212](https://github.com/TanStack/virtual/pull/1212) [`bc8643b`](https://github.com/TanStack/virtual/commit/bc8643b7579e10e512654f58269de13d98b48781) - Don't latch a scroll direction from the read-back of the virtualizer's own adjustment write

  `applyScrollAdjustment` folds the pending adjustment into `scrollOffset` eagerly, so the browser's scroll event for that write arrives at exactly the held offset. The scroll-direction computation treated that equality as `'backward'`, which made the default `shouldAdjustScrollPositionOnItemSizeChange` skip above-viewport re-measure compensation for the rest of the `isScrollingResetDelay` window — so during multi-frame reflows (e.g. a side pane's width animation re-wrapping rows while scrolled up) most frames went uncompensated and the viewport drifted. An event at the held offset carries no direction information, so the direction now stays unchanged in that case; real gestures always move the offset and still latch normally.

## 3.17.2

### Patch Changes

- [#1208](https://github.com/TanStack/virtual/pull/1208) [`b04f9ee`](https://github.com/TanStack/virtual/commit/b04f9ee48f0812e89156c1dac1fa58277cc32464) - Skip redundant scroll events at unchanged offset

- [#1209](https://github.com/TanStack/virtual/pull/1209) [`37be284`](https://github.com/TanStack/virtual/commit/37be28427ba52399ce8884e0006933e83f2645e9) - Sync `scrollOffset` in `applyScrollAdjustment` so end-anchored streaming resize isn't lost to browser clamp

  With `anchorTo: 'end'` and a dynamically growing last item (token streaming), `resizeItem` writes the scroll adjustment to `scrollTop` before the consumer has grown the sizer, so the browser clamps the write and no scroll event fires. `scrollOffset` stayed stale, the next tick's `wasAtEnd` check failed, and the viewport drifted away from the end. This fix carries the intended target in `scrollOffset` (zeroing `scrollAdjustments`) the same way the prepend path in `setOptions` does, so the next `getVirtualDistanceFromEnd()` reads the post-adjustment position.

## 3.17.1

### Patch Changes

- [#1199](https://github.com/TanStack/virtual/pull/1199) [`ef69ea3`](https://github.com/TanStack/virtual/commit/ef69ea31738caa2819142e922efa03d3c408e25c) - Fix "items jump while scrolling up": the default scroll-adjustment predicate now compensates scrollTop on the first measurement of an above-viewport item even while scrolling backward (the estimate→actual delta must be absorbed), and only skips compensation for re-measurements during backward scroll to avoid the cascading jank

## 3.17.0

### Minor Changes

- [#1186](https://github.com/TanStack/virtual/pull/1186) [`fbf3bdb`](https://github.com/TanStack/virtual/commit/fbf3bdbe38a2b1bf22c65a89752b7b9c07a77266) - Add `useCachedMeasurements` option to skip DOM measurement when the list is hidden (e.g. `display: none`). When enabled, the default `measureElement` returns the cached size or `estimateSize` fallback instead of reading the DOM, preventing ResizeObserver from resetting measurements to zero.

### Patch Changes

- [#1183](https://github.com/TanStack/virtual/pull/1183) [`c0b84c8`](https://github.com/TanStack/virtual/commit/c0b84c83f03de1244649f9838a408faf75ed29c9) - Skip synchronous DOM read (offsetWidth/offsetHeight) in default measureElement when a cached size already exists, reducing layout reflow on re-renders

## 3.16.1

### Patch Changes

- Eagerly adjust scrollOffset on prepend to prevent one-frame jump with anchorTo: 'end' ([#1176](https://github.com/TanStack/virtual/pull/1176))

  When items are prepended with `anchorTo: 'end'` and dynamic sizes, the virtualizer would compute the wrong visible range for one frame (using stale estimate-based positions) and then correct in the next frame via `_willUpdate`, producing a visible jump. This fix eagerly adjusts `scrollOffset` in `setOptions` during the render pass so `calculateRange`/`getVirtualItems` return the correct items immediately.

## 3.16.0

### Minor Changes

- Add end-anchored virtualization support for chat, logs, and reverse feeds. ([#1173](https://github.com/TanStack/virtual/pull/1173))

  New `anchorTo: 'end'` mode keeps the current visible item stable when older items are prepended, while preserving the existing start-anchored behavior by default. It also keeps an end-pinned viewport pinned when the last item grows during streaming output.

  Add `followOnAppend` so new items scroll into view only when the viewport was already at the end, plus `scrollEndThreshold`, `scrollToEnd()`, `getDistanceFromEnd()`, and `isAtEnd()` helpers for chat-style integrations.

## 3.15.0

### Minor Changes

- iOS Safari momentum-scroll handling. Writing `scrollTop` while a finger ([#1168](https://github.com/TanStack/virtual/pull/1168))
  is on the screen, during momentum decay, or while the page is in the
  elastic-overscroll bounce zone all cancel the in-flight scroll in iOS
  WebKit. The virtualizer previously had no iOS-specific handling, which
  manifested as the recurring "scroll abruptly stops when content above
  resizes" complaints on Safari mobile.

  Adds three layers of protection, default-on, all transparent to
  consumers:
  - **Touch event distinction.** A touchstart→touchend window plus a
    150 ms grace timer for the early-momentum phase. Scroll-position
    adjustments triggered during any of these states accumulate into a
    `_iosDeferredAdjustment` field instead of writing `scrollTop`.
  - **Subpixel reconciliation.** When the browser reports back a rounded
    `scrollTop` within 1.5 px of a value we just wrote, the virtualizer
    prefers the intended value rather than treating the round-trip as a
    user scroll.
  - **Elastic-overscroll clamp.** The deferred-adjustment flush is skipped
    when `scrollTop` is outside `[0, scrollHeight - clientHeight]`,
    preventing a snap-back jolt at end-of-bounce. The next in-bounds
    scroll event retries.

  Non-iOS code paths are unchanged. iOS detection is SSR-safe and cached
  after first call. Bundle cost is ~370 B gzip in the consumer-minified
  production build — kept default-on because iOS Safari is a large share
  of mobile traffic for the apps that use virtualization heavily.

- Skip the scroll-position adjustment while the user is scrolling backward ([#1168](https://github.com/TanStack/virtual/pull/1168))
  by default. When an above-viewport item resizes during backward scroll
  (images load, content reflows, etc.) the prior behavior wrote `scrollTop`
  to keep the visible window stable — but on backward scroll that write
  fights the user's direction and produces visible "items jump up while I
  scroll up" jank. This was the largest single complaint cluster in the
  issue tracker (multiple recurring threads spanning years; users had
  independently rediscovered the same workaround at least five times).

  Forward-scroll and idle (mount-time) adjustments still fire as before
  to preserve visual stability of the visible window. Consumers who want
  the old behavior — adjusting on every above-viewport resize regardless
  of direction — can supply `shouldAdjustScrollPositionOnItemSizeChange`
  which is checked before the default branch.

- Add `takeSnapshot()` instance method for scroll-restoration round-trips. ([#1168](https://github.com/TanStack/virtual/pull/1168))
  Returns the currently-measured items as plain `VirtualItem` objects;
  pair with the current `scrollOffset` to persist scroll position across
  remounts (route navigation, list-view modals, etc.). The result feeds
  back through the existing `initialMeasurementsCache` option:

  ```tsx
  const snapshot = virtualizer.takeSnapshot()
  const offset = virtualizer.scrollOffset
  // later, on remount:
  useVirtualizer({
    // …
    initialMeasurementsCache: snapshot,
    initialOffset: offset,
  })
  ```

  Closes the gap to virtua's `takeCacheSnapshot()` and react-virtuoso's
  `getState`. Only items actually rendered (and thus measured) are
  included; unmeasured items fall back to `estimateSize` on restore.

- Mount-time, measurement, and memory rewrite for huge lists. The hot path ([#1168](https://github.com/TanStack/virtual/pull/1168))
  through `getMeasurements()` no longer allocates a `VirtualItem` object per
  index for single-lane lists; instead it fills a `Float64Array` of
  start/size pairs and materializes `VirtualItem` objects lazily through a
  `Proxy`-backed view when consumers index into them. Internal hot paths
  (`calculateRange`, `getVirtualItemForOffset`, `getTotalSize`, `resizeItem`)
  read directly from the typed-array storage to avoid the Proxy.

  Also collapses a chain of smaller hotspots discovered in an audit pass:
  the per-resize `Map` clone in `resizeItem`, the `Object.entries+delete`
  deopt in `setOptions`, the `Math.min(...pendingMeasuredCacheIndexes)`
  spread, the `defaultRangeExtractor` `push` growth pattern, the eager
  `measurementsCache` reference invalidation, and the leaked `elementsCache`
  entries when a `ResizeObserver` fires for a node React already replaced.

  Headline impact (measured against actual `Virtualizer` instances with
  vitest bench):
  - Cold mount @ 100k items: ~2.5 ms → ~0.5 ms (4.7×)
  - Cold mount @ 500k items: ~14 ms → ~2.7 ms (5.2×)
  - `resizeItem` storm of 10,000 measurements + final `getMeasurements`:
    ~1.9 s → ~1.3 ms (≈1382×) — this was the dominant `Map`-clone bug
  - `setOptions` × 10,000 calls (React-render-storm proxy): ~14 ms → ~1.3 ms
    (11×)

  The lanes>1 path keeps the previous eager allocation (lane assignment is
  order-dependent and harder to defer cleanly); behavior is unchanged
  there.

  No public API change. `measurementsCache` is still an
  `Array<VirtualItem>`-shaped value supporting `[i]`, `.length`, iteration,
  etc. Internal consumers that previously read fields off `VirtualItem`
  objects continue to do so transparently.

### Patch Changes

- `scrollToIndex(N, { behavior: 'smooth' })` on a dynamic-height list no ([#1168](https://github.com/TanStack/virtual/pull/1168))
  longer snaps to `behavior: 'auto'` the moment a measurement shifts the
  computed target offset. While the scroll is still more than a viewport
  away from the new target, smooth scroll continues with the updated
  endpoint; only on the final approach do we fall back to 'auto' for
  precise landing. The user-visible effect is one continuous smooth
  motion that subtly adjusts its endpoint as measurements arrive,
  instead of the prior animation-then-snap pattern.

  Also: once `reconcileScroll` reaches its stable-frames threshold, it
  writes the exact target offset one final time. This is a no-op when
  `scrollTop` already equals the target (the common case) but corrects
  the rare subpixel-rounding case where smooth scroll undershoots by
  less than 1 px.

- Don't call `getItemKey` with a possibly-stale index when cleaning up ([#1168](https://github.com/TanStack/virtual/pull/1168))
  `elementsCache` for a disconnected node. The cleanup now finds the
  matching entry by node identity, so removing items from the end of
  the list while a `ResizeObserver` still has the now-detached node
  queued no longer throws (regression of #1148).

- Two correctness fixes in the new code: ([#1168](https://github.com/TanStack/virtual/pull/1168))
  - `measure()` now resets `pendingMin` so a prior `resizeItem()` that left
    it non-null can't preserve stale `measurementsCache` entries before that
    index. The next rebuild is guaranteed to start at 0.
  - The iOS deferred-adjustment flush now rolls its accumulated delta into
    `scrollAdjustments`. Without this, a resize landing between the flush
    and the resulting scroll event would compute the next correction from
    the stale pre-flush offset.

## 3.14.0

### Minor Changes

- feat(virtual-core): add laneAssignmentMode option ([#1115](https://github.com/TanStack/virtual/pull/1115))

## 3.13.23

### Patch Changes

- fix(virtual-core): remove incorrect elementsCache cleanup using getItemKey ([#1148](https://github.com/TanStack/virtual/pull/1148))

## 3.13.22

### Patch Changes

- Add 'instant' to ScrollBehavior type to match the W3C spec ([#1122](https://github.com/TanStack/virtual/pull/1122))

- perf(virtual-core): skip sync DOM reads during normal scrolling ([#1146](https://github.com/TanStack/virtual/pull/1146))

## 3.13.21

### Patch Changes

- fix(virtual-core): smooth scrolling for dynamic item sizes ([#1108](https://github.com/TanStack/virtual/pull/1108))

## 3.13.20

### Patch Changes

- fix(virtual-core): early return in \_measureElement for disconnected nodes ([#1135](https://github.com/TanStack/virtual/pull/1135))

## 3.13.19

### Patch Changes

- Fix crash when component unmounts during `scrollToIndex` by adding a null guard for `targetWindow` inside the `requestAnimationFrame` callback ([#1129](https://github.com/TanStack/virtual/pull/1129))

## 3.13.18

### Patch Changes

- revert(virtual-core): "notify framework when count changes" 2542c5a ([#1112](https://github.com/TanStack/virtual/pull/1112))

## 3.13.17

### Patch Changes

- fix(virtual-core): preserve auto alignment for visible items when scrolling ([#1110](https://github.com/TanStack/virtual/pull/1110))

## 3.13.16

### Patch Changes

- fix(virtual-core): improve scrollToIndex reliability in dynamic mode ([#1106](https://github.com/TanStack/virtual/pull/1106))
  - Wait extra frame for ResizeObserver measurements before verifying position
  - Abort pending scroll operations when new scrollToIndex is called

## 3.13.15

### Patch Changes

- fix(virtual-core): scroll to last index properly ([#1105](https://github.com/TanStack/virtual/pull/1105))

## 3.13.14

### Patch Changes

- Fix: Correct lane assignments when lane count changes dynamically ([#1095](https://github.com/TanStack/virtual/pull/1095))

  Fixed a critical bug where changing the number of lanes dynamically would cause layout breakage with incorrect lane assignments. When the lane count changed (e.g., from 3 to 2 columns in a responsive masonry layout), some virtual items would retain their old lane numbers, causing out-of-bounds errors and broken layouts.

  **Root Cause**: After clearing measurements cache on lane change, the virtualizer was incorrectly restoring data from `initialMeasurementsCache`, which contained stale lane assignments from the previous lane count.

  **Fix**: Skip `initialMeasurementsCache` restoration during lane transitions by checking the `lanesSettling` flag. This ensures all measurements are recalculated with correct lane assignments for the new lane count.

  **Before**:

  ```typescript
  // With lanes = 2
  virtualItems.forEach((item) => {
    columns[item.lane].push(item) // ❌ Error: item.lane could be 3
  })
  ```

  **After**:

  ```typescript
  // With lanes = 2
  virtualItems.forEach((item) => {
    columns[item.lane].push(item) // ✅ item.lane is always 0 or 1
  })
  ```

  This fix is essential for responsive masonry layouts where column count changes based on viewport width. No performance impact as it only affects the lane change transition path.

## 3.13.13

### Patch Changes

- Fix: Notify framework when count changes to update getTotalSize() ([#1085](https://github.com/TanStack/virtual/pull/1085))

  Fixed an issue where `getTotalSize()` would return stale values when the `count` option changed (e.g., during filtering or search operations). The virtualizer now automatically notifies the framework when measurement-affecting options change, ensuring the UI updates correctly without requiring manual `useMemo` workarounds.

  **Before**: When filtering items, the list container would maintain its previous height, causing excessive blank space (when count decreased) or inaccessible items (when count increased).

  **After**: Height updates automatically when count changes, providing the correct user experience.

  This fix applies to all framework adapters and has minimal performance impact (< 0.1ms per change).

- fix: stabilize lane assignments in masonry layout ([#1080](https://github.com/TanStack/virtual/pull/1080))

  Added lane assignment caching to prevent items from jumping between lanes when viewport is resized. Previously, items could shift to different lanes during resize due to recalculating "shortest lane" with slightly different heights.

  Changes:
  - Added `laneAssignments` cache (Map<index, lane>) to persist lane assignments
  - Lane cache is cleared when `lanes` option changes or `measure()` is called
  - Lane cache is cleaned up when `count` decreases (removes stale entries)
  - Lane cache is cleared when virtualizer is disabled

## 3.13.12

### Patch Changes

- fix(virtual-core): scroll to index doesn't scroll to bottom correctly ([#1029](https://github.com/TanStack/virtual/pull/1029))

## 3.13.11

### Patch Changes

- Revert "Adapt default logic to adjust scroll position only on backward scrolling (#1002)" ([#1026](https://github.com/TanStack/virtual/pull/1026))

## 3.13.10

### Patch Changes

- fix(virtual-core): Adapt default logic to adjust scroll position only on backward scrolling ([#1002](https://github.com/TanStack/virtual/pull/1002))

## 3.13.9

### Patch Changes

- fix(virtual-core): fix `Error: Unexpected undefined` ([#1004](https://github.com/TanStack/virtual/pull/1004))

## 3.13.8

### Patch Changes

- fix(virtual-core): loosen approxEqual to allow 1px difference ([#995](https://github.com/TanStack/virtual/pull/995))

## 3.13.7

### Patch Changes

- fix(virtual-core): prevent measurement jitter when scale is applied ([#986](https://github.com/TanStack/virtual/pull/986))

## 3.13.6

### Patch Changes

- fix(virtual-core): fix total size calculation for single item in multi-lane ([`042616f`](https://github.com/TanStack/virtual/commit/042616f39ced842470db0b4b40fca77f22454b7f))

## 3.13.5

### Patch Changes

- fix(core): handle case when item count is less than or equal to lanes ([#964](https://github.com/TanStack/virtual/pull/964))

## 3.13.4

### Patch Changes

- fix(virtual-core): update maybeNotify cache when deps change ([#957](https://github.com/TanStack/virtual/pull/957))

- fix(virtual-core): set `useScrollendEvent` default to false for bette… ([#951](https://github.com/TanStack/virtual/pull/951))

## 3.13.3

### Patch Changes

- fix(virtual-core): expand range in masonry layouts to catch items from all lanes ([#937](https://github.com/TanStack/virtual/pull/937))
