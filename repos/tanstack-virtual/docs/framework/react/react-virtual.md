---
title: React Virtual
---

The `@tanstack/react-virtual` adapter is a wrapper around the core virtual logic.

## `useVirtualizer`

```tsx
function useVirtualizer<TScrollElement, TItemElement = unknown>(
  options: PartialKeys<
    ReactVirtualizerOptions<TScrollElement, TItemElement>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  >,
): Virtualizer<TScrollElement, TItemElement>
```

This function returns a standard `Virtualizer` instance configured to work with an HTML element as the scrollElement.

## `useWindowVirtualizer`

```tsx
function useWindowVirtualizer<TItemElement = unknown>(
  options: PartialKeys<
    ReactVirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): Virtualizer<Window, TItemElement>
```

This function returns a window-based `Virtualizer` instance configured to work with the window as the scrollElement.

## React-Specific Options

### `useFlushSync`

```tsx
type ReactVirtualizerOptions<TScrollElement, TItemElement> = 
  VirtualizerOptions<TScrollElement, TItemElement> & {
    useFlushSync?: boolean
  }
```

Both `useVirtualizer` and `useWindowVirtualizer` accept a `useFlushSync` option that controls whether React's `flushSync` is used for synchronous updates.

- **Type**: `boolean`
- **Default**: `true`
- **Description**: When `true`, the virtualizer will use `flushSync` from `react-dom` to ensure synchronous rendering during scroll events. This provides the most accurate scrolling behavior but may impact performance in some scenarios.

#### When to disable `useFlushSync`

You may want to set `useFlushSync: false` in the following scenarios:

- **React 19 compatibility**: In React 19, you may see the following console warning when scrolling:
  ```
  flushSync was called from inside a lifecycle method. React cannot flush when React is already rendering. Consider moving this call to a scheduler task or micro task.
  ```
  Setting `useFlushSync: false` will eliminate this warning by allowing React to batch updates naturally.
- **Performance optimization**: If you experience performance issues with rapid scrolling on lower-end devices
- **Testing environments**: When running tests that don't require synchronous DOM updates
- **Non-critical lists**: When slight visual delays during scrolling are acceptable for better overall performance

#### Example

```tsx
const virtualizer = useVirtualizer({
  count: 10000,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
  useFlushSync: false, // Disable synchronous updates
})
```

### `directDomUpdates`

- **Type**: `boolean`
- **Default**: `false`
- **Description**: Skip React re-renders for scroll-only updates. When enabled, the virtualizer writes item positions (`top`/`left` or `transform`) and the container size (`height`/`width`) directly to the DOM, and only re-renders when the visible index range or `isScrolling` changes.

#### Requirements when enabled

- Item elements must be `position: absolute`; in `'transform'` mode they must also be anchored with `top: 0` / `left: 0`.
- Item elements must **not** set the main-axis position in their style — the virtualizer owns `top` / `left` in `'position'` mode and `transform` in `'transform'` mode.
- The inner size container must receive `virtualizer.containerRef` and must **not** set `height` / `width` in its style.
- For multi-lane layouts (grids / masonry), the cross-axis position (e.g. `left: ${(item.lane * 100) / lanes}%`) is stable per item and must still be set in your JSX — only the main axis is automated.

> ⚠️ This flag is intended to be set once at mount. Toggling it (or `directDomUpdatesMode`) at runtime can leave stale inline styles on items and the container.

> **Note:** If you omit `containerRef`, the virtualizer makes no direct DOM writes — it writes neither item positions nor the container size. You're then responsible for positioning items and sizing the container yourself (e.g. in `onChange`), while still benefiting from the skipped re-renders.

#### Example

```tsx
const virtualizer = useVirtualizer({
  count: 10000,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
  directDomUpdates: true,
})

return (
  <div ref={parentRef} style={{ overflow: 'auto', height: 400 }}>
    {/* The inner container must use virtualizer.containerRef and not set height */}
    <div ref={virtualizer.containerRef} style={{ position: 'relative' }}>
      {virtualizer.getVirtualItems().map((item) => (
        <div
          key={item.key}
          ref={virtualizer.measureElement}
          data-index={item.index}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            // Do NOT set top/left/transform — the virtualizer handles it
          }}
        >
          Row {item.index}
        </div>
      ))}
    </div>
  </div>
)
```

### `directDomUpdatesMode`

- **Type**: `'position' | 'transform'`
- **Default**: `'transform'`
- **Description**: Controls how `directDomUpdates` positions item elements.
  - `'transform'` (default): writes `transform: translate3d(...)`. Promotes items to their own compositor layer — usually smoother on long lists, but creates a stacking context and can interfere with `position: fixed` descendants. Item elements must be anchored with `position: absolute`, `top: 0`, and `left: 0`.
  - `'position'`: writes `top` / `left`. Item elements must be `position: absolute`.

#### Example

```tsx
const virtualizer = useVirtualizer({
  count: 10000,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50,
  directDomUpdates: true,
  directDomUpdatesMode: 'position', // Use top/left instead of transform
})
```
