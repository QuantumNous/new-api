# @tanstack/marko-virtual

Headless UI for virtualizing scrollable elements in [Marko 6](https://markojs.com), built on top of [`@tanstack/virtual-core`](https://tanstack.com/virtual).

Part of the [TanStack Virtual](https://tanstack.com/virtual) family.

## Installation

```bash
npm install @tanstack/marko-virtual
# or
pnpm add @tanstack/marko-virtual
```

**Peer dependency:** `marko ^6.0.0`

## Setup

Add to your project's `marko.json` to make the tags available:

```json
{
  "taglib-imports": ["@tanstack/marko-virtual/marko.json"]
}
```

## Usage

### `<virtualizer>` — scrollable container

Use when you control the scroll element (a div with `overflow: auto`).

```marko
<!DOCTYPE html>
<html>
<body>

<let/mounted = false/>
<script() { mounted = true }/>

<div/scrollEl style="height: 400px; overflow-y: auto">
  <if=mounted>
    <virtualizer|{ virtualItems, totalSize }|
      count=10000
      estimateSize=() => 35
      getScrollElement=scrollEl
    >
      <div style=`height: ${totalSize}px; position: relative`>
        <for|item| of=virtualItems>
          <div
            data-index=item.index
            style=`position: absolute; transform: translateY(${item.start}px);
                   height: ${item.size}px; width: 100%`
          >
            Row ${item.index}
          </div>
        </for>
      </div>
    </virtualizer>
  </if>
</div>

</body>
</html>
```

> **Why `mounted`?** The virtualizer measures the scroll element's dimensions on mount. During SSR the DOM has no layout, so `offsetHeight` is 0 and no items would be calculated. The `<if=mounted>` guard ensures the virtualizer only renders after the browser has real dimensions available.

### `<window-virtualizer>` — full-page scrolling

Use when the page itself is the scroll container.

```marko
<!DOCTYPE html>
<html>
<body>

<window-virtualizer|{ virtualItems, totalSize }| count=10000 estimateSize=() => 35>
  <div style=`height: ${totalSize}px; position: relative`>
    <for|item| of=virtualItems>
      <div
        data-index=item.index
        style=`position: absolute; transform: translateY(${item.start}px);
               height: ${item.size}px; width: 100%`
      >
        Row ${item.index}
      </div>
    </for>
  </div>
</window-virtualizer>

</body>
</html>
```

## Tag parameters

Both tags use Marko 6's tag parameters pattern. The body receives virtual state via `|{ ... }|` destructuring:

```marko
<virtualizer|{ virtualItems, totalSize, measureElement, scrollToIndex, scrollToOffset }|
  count=...
  getScrollElement=...
>
  <!-- virtualItems, totalSize etc are in scope here -->
</virtualizer>
```

## API Reference

### `<virtualizer>`

| Attribute            | Type                        | Required | Description                                         |
| -------------------- | --------------------------- | -------- | --------------------------------------------------- |
| `count`              | `number`                    | ✅       | Total number of items                               |
| `getScrollElement`   | `() => Element \| null`     | ✅       | Returns the scroll container                        |
| `estimateSize`       | `(index: number) => number` |          | Estimated item size in px (default: `50`)           |
| `overscan`           | `number`                    |          | Items to render outside the viewport (default: `5`) |
| `horizontal`         | `boolean`                   |          | Enable horizontal scrolling (default: `false`)      |
| `paddingStart`       | `number`                    |          | Padding before the first item in px                 |
| `paddingEnd`         | `number`                    |          | Padding after the last item in px                   |
| `scrollPaddingStart` | `number`                    |          | Scroll padding at the start                         |
| `scrollPaddingEnd`   | `number`                    |          | Scroll padding at the end                           |
| `gap`                | `number`                    |          | Gap between items in px                             |
| `lanes`              | `number`                    |          | Number of lanes for grid layouts                    |
| `initialOffset`      | `number \| (() => number)`  |          | Initial scroll offset                               |

**Tag parameters provided to body:**

| Parameter        | Type                                                  | Description                                              |
| ---------------- | ----------------------------------------------------- | -------------------------------------------------------- |
| `virtualItems`   | `VirtualItem[]`                                       | Items to render, with `index`, `start`, `size`, `key`    |
| `totalSize`      | `number`                                              | Total scrollable size in px — set on the inner container |
| `measureElement` | `(el: Element \| null) => void`                       | Pass to `ref` for dynamic size measurement               |
| `scrollToIndex`  | `(index: number, options?: ScrollToOptions) => void`  | Scroll to an item by index                               |
| `scrollToOffset` | `(offset: number, options?: ScrollToOptions) => void` | Scroll to a px offset                                    |

### `<window-virtualizer>`

Same as `<virtualizer>` except there is no `getScrollElement`, `horizontal`, or `initialOffset` — the window is always the scroll container.

## Examples

All examples use `@marko/run`. Run any with:

```bash
pnpm --filter tanstack-marko-virtual-example-<name> dev
```

| Example           | Description                                     |
| ----------------- | ----------------------------------------------- |
| `fixed`           | Fixed-size rows, columns, and grid              |
| `variable`        | Variable sizes via `estimateSize`               |
| `dynamic`         | Unknown sizes measured via `measureElement`     |
| `grid`            | Two virtualizers sharing one scroll element     |
| `smooth-scroll`   | `scrollToIndex` with CSS smooth scrolling       |
| `infinite-scroll` | Lazy data loading with a fixed total count      |
| `window`          | Full-page scrolling with `<window-virtualizer>` |

## Dynamic sizing

Use `measureElement` to measure items whose size isn't known upfront:

```marko
<virtualizer|{ virtualItems, totalSize, measureElement }|
  count=items.length
  estimateSize=() => 50
  getScrollElement=scrollEl
>
  <div style=`height: ${totalSize}px; position: relative`>
    <for|item| of=virtualItems>
      <div
        ref=measureElement
        data-index=item.index
        style=`position: absolute; transform: translateY(${item.start}px); width: 100%`
      >
        ${items[item.index]}
      </div>
    </for>
  </div>
</virtualizer>
```

> `data-index` is required on measured elements — the virtualizer uses it to map measurements back to items.

## TypeScript

The tags are fully typed. The Marko language server reads the source `.marko` files directly — no `.d.ts` generation is needed. Ensure `@marko/language-tools` is installed in your editor for IDE support.

## License

MIT © [Tanner Linsley](https://github.com/tannerlinsley)
