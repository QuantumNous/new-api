---
title: Virtualizer
---

The `Virtualizer` class is the core of TanStack Virtual. Virtualizer instances are usually created for you by your framework adapter, but you do receive the virtualizer directly.

```tsx
export class Virtualizer<TScrollElement = unknown, TItemElement = unknown> {
  constructor(options: VirtualizerOptions<TScrollElement, TItemElement>)
}
```

## Required Options

### `count`

```tsx
count: number
```

The total number of items to virtualize.

### `getScrollElement`

```tsx
getScrollElement: () => TScrollElement
```

A function that returns the scrollable element for the virtualizer. It may return null if the element is not available yet.

### `estimateSize`

```tsx
estimateSize: (index: number) => number
```

> 🧠 If you are dynamically measuring your elements, it's recommended to estimate the largest possible size (width/height, within comfort) of your items. This will help the virtualizer calculate more accurate initial positions.

This function is passed the index of each item and should return the actual size (or estimated size if you will be dynamically measuring items with `virtualItem.measureElement`) for each item. This measurement should return either the width or height depending on the orientation of your virtualizer.

## Optional Options

### `enabled`

```tsx
enabled?: boolean
```

Set to `false` to disable scrollElement observers and reset the virtualizer's state

### `debug`

```tsx
debug?: boolean
```

Set to `true` to enable debug logs

### `initialRect`

```tsx
initialRect?: Rect
```

The initial `Rect` of the scrollElement. This is mostly useful if you need to run the virtualizer in an SSR environment, otherwise the initialRect will be calculated on mount by the `observeElementRect` implementation.

### `onChange`

```tsx
onChange?: (instance: Virtualizer<TScrollElement, TItemElement>, sync: boolean) => void
```

A callback function that fires when the virtualizer's internal state changes. It's passed the virtualizer instance and the sync parameter.

The sync parameter indicates whether scrolling is currently in progress. It is `true` when scrolling is ongoing, and `false` when scrolling has stopped or other actions (such as resizing) are being performed.

### `overscan`

```tsx
overscan?: number
```

The number of items to render above and below the visible area. Increasing this number will increase the amount of time it takes to render the virtualizer, but might decrease the likelihood of seeing slow-rendering blank items at the top and bottom of the virtualizer when scrolling. The default value is `1`.

### `horizontal`

```tsx
horizontal?: boolean
```

Set this to `true` if your virtualizer is oriented horizontally.

### `paddingStart`

```tsx
paddingStart?: number
```

The padding to apply to the start of the virtualizer in pixels.

### `paddingEnd`

```tsx
paddingEnd?: number
```

The padding to apply to the end of the virtualizer in pixels.

### `scrollPaddingStart`

```tsx
scrollPaddingStart?: number
```

The padding to apply to the start of the virtualizer in pixels when scrolling to an element.

### `scrollPaddingEnd`

```tsx
scrollPaddingEnd?: number
```

The padding to apply to the end of the virtualizer in pixels when scrolling to an element.

### `initialOffset`

```tsx
initialOffset?: number | (() => number)
```

The position where the list is scrolled to on render. This is useful if you are rendering the virtualizer in a SSR environment or are conditionally rendering the virtualizer.

### `getItemKey`

```tsx
getItemKey?: (index: number) => Key
```

This function is passed the index of each item and should return a unique key for that item. The default functionality of this function is to return the index of the item, but you should override this when possible to return a unique identifier for each item across the entire set.

**Note:** The virtualizer automatically invalidates its measurement cache when measurement-affecting options change, ensuring `getTotalSize()` and other measurements return fresh values. While the virtualizer intelligently tracks which options actually affect measurements, it's still better to memoize `getItemKey` (e.g., using `useCallback` in React) to avoid unnecessary recalculations.

### `rangeExtractor`

```tsx
rangeExtractor?: (range: Range) => number[]
```

This function receives visible range indexes and should return array of indexes to render. This is useful if you need to add or remove items from the virtualizer manually regardless of the visible range, eg. rendering sticky items, headers, footers, etc. The default range extractor implementation will return the visible range indexes and is exported as `defaultRangeExtractor`.

### `scrollToFn`

```tsx
scrollToFn?: (
  offset: number,
  options: { adjustments?: number; behavior?: 'auto' | 'smooth' },
  instance: Virtualizer<TScrollElement, TItemElement>,
) => void
```

An optional function that (if provided) should implement the scrolling behavior for your scrollElement. It will be called with the following arguments: 

- An `offset` (in pixels) to scroll towards.
- An object indicating whether there was a difference between the estimated size and actual size (`adjustments`) and/or whether scrolling was called with a smooth animation (`behaviour`).
- The virtualizer instance itself. 

Note that built-in scroll implementations are exported as `elementScroll` and `windowScroll`, which are automatically configured by the framework adapter functions like `useVirtualizer` or `useWindowVirtualizer`.

### `observeElementRect`

```tsx
observeElementRect: (
  instance: Virtualizer<TScrollElement, TItemElement>,
  cb: (rect: Rect) => void,
) => void | (() => void)
```

An optional function that if provided is called when the scrollElement changes and should implement the initial measurement and continuous monitoring of the scrollElement's `Rect` (an object with `width` and `height`). It's called with the instance (which also gives you access to the scrollElement via `instance.scrollElement`. Built-in implementations are exported as `observeElementRect` and `observeWindowRect` which are automatically configured for you by your framework adapter's exported functions like `useVirtualizer` or `useWindowVirtualizer`.

### `observeElementOffset`

```tsx
observeElementOffset: (
    instance: Virtualizer<TScrollElement, TItemElement>,
    cb: (offset: number) => void,
  ) => void | (() => void)
```

An optional function that if provided is called when the scrollElement changes and should implement the initial measurement and continuous monitoring of the scrollElement's scroll offset (a number). It's called with the instance (which also gives you access to the scrollElement via `instance.scrollElement`. Built-in implementations are exported as `observeElementOffset` and `observeWindowOffset` which are automatically configured for you by your framework adapter's exported functions like `useVirtualizer` or `useWindowVirtualizer`.

### `measureElement`

```tsx
measureElement?: (
  element: TItemElement,
  entry: ResizeObserverEntry | undefined,
  instance: Virtualizer<TScrollElement, TItemElement>,
) => number
```

This optional function is called when the virtualizer needs to dynamically measure the size (width or height) of an item.

> 🧠 You can use `instance.options.horizontal` to determine if the width or height of the item should be measured.

### `scrollMargin`

```tsx
scrollMargin?: number
```

With this option, you can specify where the scroll offset should originate. Typically, this value represents the space between the beginning of the scrolling element and the start of the list. This is especially useful in common scenarios such as when you have a header preceding a window virtualizer or when multiple virtualizers are utilized within a single scrolling element. If you are using absolute positioning of elements, you should take into account the `scrollMargin` in your CSS transform:
```tsx
transform: `translateY(${
   virtualRow.start - rowVirtualizer.options.scrollMargin
}px)` 
``` 
To dynamically measure value for `scrollMargin` you can use `getBoundingClientRect()` or ResizeObserver. This is helpful in scenarios when items above your virtual list might change their height.   

### `gap`

```tsx
gap?: number
```

This option allows you to set the spacing between items in the virtualized list. It's particularly useful for maintaining a consistent visual separation between items without having to manually adjust each item's margin or padding. The value is specified in pixels.

### `lanes`

```tsx
lanes: number
```

The number of lanes the list is divided into (aka columns for vertical lists and rows for horizontal lists). Items are assigned to the lane with the shortest total size. By default, lane assignments are cached immediately based on `estimateSize` to prevent items from jumping between lanes (see `laneAssignmentMode` below to change this behavior).

### `laneAssignmentMode`

```tsx
laneAssignmentMode?: 'estimate' | 'measured'
```

**Default**: `'estimate'`

Controls when lane assignments are cached in a masonry layout.

- `'estimate'` (default): lane assignments are cached immediately based on `estimateSize`. This keeps items from jumping between lanes, but assignments may be suboptimal when the estimate is inaccurate.
- `'measured'`: lane caching is deferred until items are measured via `measureElement`, so assignments reflect actual measured sizes. After the initial measurement, lanes are cached and remain stable.

### `anchorTo`

```tsx
anchorTo?: 'start' | 'end'
```

**Default:** `'start'`

Controls which side of the scrollable content should be treated as the stable anchor when list data changes. The default `'start'` preserves TanStack Virtual's existing top/left anchored behavior.

Set `anchorTo: 'end'` for chat, logs, and reverse/inverted feeds. In end-anchored mode, the virtualizer keeps the current visible item stable when older items are prepended, and keeps an end-pinned viewport pinned when the last item grows during streaming output. See the [Chat guide](../chat) for the full pattern.

For prepend stability, use a stable `getItemKey` based on each item's persistent id. Index keys cannot distinguish prepends from appends after items shift.

### `followOnAppend`

```tsx
followOnAppend?: boolean | 'auto' | 'smooth' | 'instant'
```

**Default:** `false`

When used with `anchorTo: 'end'`, controls whether the virtualizer scrolls to the end after new items are appended. The follow only happens if the viewport was already at the end before the append; users who have scrolled up to read history are not pulled down.

Passing `true` is equivalent to `'auto'`. Passing a scroll behavior uses that behavior for the follow.

This option does not follow prepends. It only follows appended output, and only when the viewport was already within `scrollEndThreshold` of the end before the append.

### `scrollEndThreshold`

```tsx
scrollEndThreshold?: number
```

**Default:** `1`

The pixel threshold used by `isAtEnd()` and `followOnAppend` to decide whether the viewport is close enough to the end to count as pinned.

### `isScrollingResetDelay`

```tsx
isScrollingResetDelay: number
```

This option allows you to specify the duration to wait after the last scroll event before resetting the isScrolling instance property. The default value is 150 milliseconds. 

The implementation of this option is driven by the need for a reliable mechanism to handle scrolling behavior across different browsers. Until all browsers uniformly support the scrollEnd event.

### `useScrollendEvent`

```tsx
useScrollendEvent: boolean
```

Determines whether to use the native scrollend event to detect when scrolling has stopped. If set to false, a debounced fallback is used to reset the isScrolling instance property after isScrollingResetDelay milliseconds. The default value is `false`. 

The implementation of this option is driven by the need for a reliable mechanism to handle scrolling behavior across different browsers. Until all browsers uniformly support the scrollEnd event.

### `isRtl`

```tsx
isRtl: boolean
```

Whether to invert horizontal scrolling to support right-to-left language locales.

### `initialMeasurementsCache`

```tsx
initialMeasurementsCache: Array<VirtualItem>
```

**Default:** `[]`

A previously-captured snapshot of measured item sizes (from `takeSnapshot()`) to seed the virtualizer with on mount. Useful for restoring scroll position after navigation: persist the result of `takeSnapshot()` (plus the current `scrollOffset`) in your route state, then pass them back as `initialMeasurementsCache` and `initialOffset` to land users at the same position without re-measuring everything from scratch.

Items not present in the cache fall back to `estimateSize`; items present have their measured `size` restored. The cache is consumed only once, on the first `getMeasurements()` call after mount.

### `useAnimationFrameWithResizeObserver`

```tsx
useAnimationFrameWithResizeObserver: boolean
```

**Default:** `false`

When enabled, defers ResizeObserver measurement processing to the next animation frame using `requestAnimationFrame`.

**Important:** This option typically **should not be enabled** in most cases. ResizeObserver callbacks already execute at an optimal time in the browser's rendering pipeline (after layout, before paint), and the measurements provided in the callback are pre-computed by the browser without causing additional reflows.

**Potential use cases:**
- If you're performing heavy DOM mutations in response to size changes and want to batch them with the next render cycle
- As a workaround for the "ResizeObserver loop completed with undelivered notifications" error (though this usually indicates a deeper issue that should be fixed)

**Tradeoffs:**
- **Adds ~16ms delay:** Measurements are deferred to the next frame, which can cause visual artifacts, stale measurements, or slower time-to-interactive
- **No batching benefit:** ResizeObserver already batches multiple element resizes into a single callback
- **Defeats optimization:** The browser has already computed the measurements synchronously; deferring them provides no performance benefit for reading values

Only enable this option if you have a specific reason and have measured that it improves your use case.

### `useCachedMeasurements`

```tsx
useCachedMeasurements?: boolean
```

**Default:** `false`

When enabled, the default `measureElement` implementation skips DOM measurement and returns the previously cached size for each item (falling back to `estimateSize` if no cached size exists).

This is useful when the virtualized list is temporarily hidden (e.g. via `display: none` on a parent element). Without this option, the ResizeObserver fires with size `0` for all items when hidden, resetting all measurements. When the list becomes visible again, items may need to be re-measured, which can cause layout shifts.

**Usage:** Toggle this option to `true` before hiding the list and back to `false` when showing it. The ResizeObserver remains attached, so real measurements resume automatically when the flag is turned off and elements become visible again.

> ⚠️ This option only affects the default `measureElement`. If you provide a custom `measureElement`, you are responsible for handling this case yourself.

## Virtualizer Instance

The following properties and methods are available on the virtualizer instance:

### `options`

```tsx
options: readonly Required<VirtualizerOptions<TScrollElement, TItemElement>>
```

The current options for the virtualizer. This property is updated via your framework adapter and is read-only.

### `scrollElement`

```tsx
scrollElement: readonly TScrollElement | null
```

The current scrollElement for the virtualizer. This property is updated via your framework adapter and is read-only.

### `getVirtualItems`

```tsx
type getVirtualItems = () => VirtualItem[]
```

Returns the virtual items for the current state of the virtualizer.

### `getVirtualIndexes`

```tsx
type getVirtualIndexes = () => number[]
```

Returns the virtual row indexes for the current state of the virtualizer.

### `scrollToOffset`

```tsx
scrollToOffset: (
  toOffset: number,
  options?: {
    align?: 'start' | 'center' | 'end' | 'auto',
    behavior?: 'auto' | 'smooth'
  }
) => void
```

Scrolls the virtualizer to the pixel offset provided. You can optionally pass an alignment mode to anchor the scroll to a specific part of the scrollElement.

### `scrollToIndex`

```tsx
scrollToIndex: (
  index: number,
  options?: {
    align?: 'start' | 'center' | 'end' | 'auto',
    behavior?: 'auto' | 'smooth'
  }
) => void
```

Scrolls the virtualizer to the items of the index provided. You can optionally pass an alignment mode to anchor the scroll to a specific part of the scrollElement.

> 🧠 During smooth scrolling, the virtualizer only measures items within a buffer range around the scroll target. Items far from the target are skipped to prevent their size changes from shifting the target position and breaking the smooth animation.
>
> Because of this, the preferred layout strategy for smooth scrolling is **block translation** — translate the entire rendered block using the first item's `start` offset, rather than positioning each item independently with absolute positioning. This ensures items stay correctly positioned relative to each other even when some measurements are skipped.

### `scrollBy`

```tsx
scrollBy: (
  delta: number,
  options?: {
    behavior?: 'auto' | 'smooth'
  }
) => void
```

Scrolls the virtualizer by the specified number of pixels relative to the current scroll position.

### `scrollToEnd`

```tsx
scrollToEnd: (
  options?: {
    behavior?: 'auto' | 'smooth' | 'instant'
  }
) => void
```

Scrolls the virtualizer to the end of the content. For vertical lists this is the bottom; for horizontal lists this is the right edge.

This is useful for "Jump to latest" controls in chat and log views.

### `getDistanceFromEnd`

```tsx
getDistanceFromEnd: () => number
```

Returns the current pixel distance from the end of the virtualized content.

For a vertical list, this is the distance from the bottom.

### `isAtEnd`

```tsx
isAtEnd: (threshold?: number) => boolean
```

Returns whether the viewport is within `threshold` pixels of the end. If no threshold is provided, `scrollEndThreshold` is used.

Use this to decide whether to show "Jump to latest" UI or whether incoming output should be treated as pinned.

### `getTotalSize`

```tsx
getTotalSize: () => number
```

Returns the total size in pixels for the virtualized items. This measurement will incrementally change if you choose to dynamically measure your elements as they are rendered.

### `measure`

```tsx
measure: () => void
```

Resets any prev item measurements.

### `takeSnapshot`

```tsx
takeSnapshot: () => Array<VirtualItem>
```

Returns a snapshot of currently-measured items as plain `VirtualItem`
objects, suitable for round-tripping through state storage and feeding
back as `initialMeasurementsCache` on remount. Pair with the current
`scrollOffset` to restore exact scroll position after navigation.

Only items the consumer has actually rendered (and thus measured) appear
in the snapshot; unmeasured items will fall back to `estimateSize` on
restore. Returns an empty array if no items have been measured.

```tsx
// Capture state on unmount
const snapshot = virtualizer.takeSnapshot()
const offset = virtualizer.scrollOffset
sessionStorage.setItem('myList', JSON.stringify({ snapshot, offset }))

// Restore on remount
const saved = JSON.parse(sessionStorage.getItem('myList') ?? 'null')
useVirtualizer({
  count: items.length,
  estimateSize: () => 50,
  getScrollElement: () => parentRef.current,
  initialMeasurementsCache: saved?.snapshot,
  initialOffset: saved?.offset,
})
```

### `measureElement`

```tsx
measureElement: (el: TItemElement | null) => void
```

Measures the element using your configured `measureElement` virtualizer option. You are responsible for calling this in your virtualizer markup when the component is rendered (eg. using something like React's ref callback prop) also adding `data-index`

```tsx
 <div
  key={virtualRow.key}
  data-index={virtualRow.index}
  ref={virtualizer.measureElement}
  style={...}
>...</div>
```

By default the `measureElement` virtualizer option is configured to measure elements with `getBoundingClientRect()`.

### `resizeItem`

```tsx
resizeItem: (index: number, size: number) => void
```

Change the virtualized item's size manually. Use this function to manually set the size calculated for this index. Useful in occations when using some custom morphing transition and you know the morphed item's size beforehand.

You can also use this method with a throttled ResizeObserver instead of `Virtualizer.measureElement` to reduce re-rendering.

> ⚠️ Please be aware that manually changing the size of an item when using `Virtualizer.measureElement` to monitor that item, will result in unpredictable behaviour as the `Virtualizer.measureElement` is also changing the size. However you can use one of resizeItem or measureElement in the same virtualizer instance but on different item indexes.

### `scrollRect`

```tsx
scrollRect: Rect
```

Current `Rect` of the scroll element.

### `shouldAdjustScrollPositionOnItemSizeChange`

```tsx
shouldAdjustScrollPositionOnItemSizeChange: undefined | ((item: VirtualItem, delta: number, instance: Virtualizer<TScrollElement, TItemElement>) => boolean)
```

Provides fine-grained control over the scroll-position adjustment that fires when an above-viewport item's measured size differs from its estimated size. By default the virtualizer applies this correction only when the user is **not** scrolling backward, which avoids the well-known "items jump while scrolling up" jank. Supply this callback only if you want to override that default — for example, to apply corrections during backward scroll, or to skip them in additional scenarios.

The callback receives the resized `item`, the size `delta`, and the `instance`; return `true` to apply the scroll adjustment, `false` to skip it.

On iOS WebKit, scroll-position writes are deferred regardless of this callback while a finger is on screen, during momentum-scroll, and during elastic-overscroll bounce. The cumulative delta is flushed in a single write once the scroll settles, preserving iOS's native momentum physics.

### `isScrolling`

```tsx
isScrolling: boolean
```

Boolean flag indicating if list is currently being scrolled.

### `scrollDirection`

```tsx
scrollDirection: 'forward' | 'backward' | null
```

This option indicates the direction of scrolling, with possible values being 'forward' for scrolling downwards and 'backward' for scrolling upwards. The value is set to null when there is no active scrolling.

### `scrollOffset`

```tsx
scrollOffset: number
```

This option represents the current scroll position along the scrolling axis. It is measured in pixels from the starting point of the scrollable area.
