# Marko Virtual

`@tanstack/marko-virtual` is the Marko 6 adapter for TanStack Virtual. It provides
row, column, and grid virtualisation via two auto-discovered Marko tags:

- **`<virtualizer>`** — element-based scrolling (rows, columns, grids)
- **`<window-virtualizer>`** — full-page/window scrolling

Tags are discovered automatically by the Marko compiler when the package is
installed. No imports are needed in your `.marko` files.

## Installation

```sh
npm install @tanstack/marko-virtual
```

## Row virtualisation

```marko
<let/mounted = false/>
<lifecycle onMount() { mounted = true }/>

<if=mounted>
  <div/scrollEl
    style="height: 400px; width: 400px; overflow-y: auto; position: relative;"
  >
    <virtualizer|{ virtualItems, totalSize }|
      count=10000
      estimateSize=() => 35
      getScrollElement=scrollEl
    >
      <div style=`height: ${totalSize}px; width: 100%; position: relative`>
        <for|item| of=virtualItems>
          <div
            style=`
              position: absolute;
              top: 0;
              left: 0;
              width: 100%;
              height: ${item.size}px;
              transform: translateY(${item.start}px);
            `
          >
            Row ${item.index}
          </div>
        </for>
      </div>
    </virtualizer>
  </div>
</if>
```

## Column virtualisation

Same tag, `horizontal=true`:

```marko
<div/scrollEl
  style="width: 400px; height: 100px; overflow-x: auto; position: relative;"
>
  <virtualizer|{ virtualItems, totalSize }|
    count=10000
    estimateSize=() => 100
    horizontal=true
    getScrollElement=scrollEl
  >
    <div style=`width: ${totalSize}px; height: 100%; position: relative`>
      <for|item| of=virtualItems>
        <div
          style=`
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: ${item.size}px;
            transform: translateX(${item.start}px);
          `
        >
          Column ${item.index}
        </div>
      </for>
    </div>
  </virtualizer>
</div>
```

## Grid virtualisation

Compose two `<virtualizer>` tags — one for rows, one for columns — sharing the
same scroll element:

```marko
<div/scrollEl
  style="height: 500px; width: 500px; overflow: auto; position: relative;"
>
  <virtualizer|{ virtualItems: rowItems, totalSize: rowTotal }|
    count=10000
    estimateSize=() => 35
    getScrollElement=scrollEl
  >
    <virtualizer|{ virtualItems: colItems, totalSize: colTotal }|
      count=200
      estimateSize=() => 100
      horizontal=true
      getScrollElement=scrollEl
    >
      <div style=`height: ${rowTotal}px; width: ${colTotal}px; position: relative`>
        <for|row| of=rowItems>
          <for|col| of=colItems>
            <div
              style=`
                position: absolute;
                top: 0;
                left: 0;
                width: ${col.size}px;
                height: ${row.size}px;
                transform: translateX(${col.start}px) translateY(${row.start}px);
              `
            >
              Cell ${row.index}, ${col.index}
            </div>
          </for>
        </for>
      </div>
    </virtualizer>
  </virtualizer>
</div>
```

## Window virtualisation

Use `<window-virtualizer>` when the entire page scrolls rather than a container:

```marko
<window-virtualizer|{ virtualItems, totalSize }|
  count=10000
  estimateSize=() => 35
>
  <div style=`height: ${totalSize}px; position: relative`>
    <for|item| of=virtualItems>
      <div
        style=`
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: ${item.size}px;
          transform: translateY(${item.start}px);
        `
      >
        Row ${item.index}
      </div>
    </for>
  </div>
</window-virtualizer>
```

## Dynamic / variable item sizes

For items with unknown heights, use `measureElement` as an effect-driven ref
to measure each element after render:

```marko
<div/scrollEl style="height: 400px; overflow-y: auto">
  <virtualizer|{ virtualItems, totalSize, measureElement }|
    count=data.length
    estimateSize=() => 50
    getScrollElement=scrollEl
  >
    <div style=`height: ${totalSize}px; position: relative`>
      <for|item| of=virtualItems>
        <div/el
          data-index=item.index
          style=`position: absolute; top: 0; width: 100%; transform: translateY(${item.start}px)`>
          <effect() {
            // measureElement reads the actual rendered height and updates the virtualizer
            if (el() && measureElement) measureElement(el())
          }/>
          ${data[item.index].text}
        </div>
      </for>
    </div>
  </virtualizer>
</div>
```

## Tag variable reference

Both tags expose the same tag variable shape:

| Property | Type | Description |
|---|---|---|
| `virtualItems` | `VirtualItem[]` | The currently visible virtual items |
| `totalSize` | `number` | Total scrollable size in px — set as the inner container's `height` (or `width` for columns) |
| `measureElement` | `(el: Element \| null) => void` | Ref callback for dynamic item sizing |
| `scrollToIndex` | `(index: number, options?: ScrollToOptions) => void` | Imperatively scroll to an item by index |
| `scrollToOffset` | `(offset: number, options?: ScrollToOptions) => void` | Imperatively scroll to a pixel offset |

## `<virtualizer>` input reference

| Prop | Type | Default | Description |
|---|---|---|---|
| `count` | `number` | required | Number of items |
| `getScrollElement` | `() => Element \| null` | required | Returns the scroll container |
| `estimateSize` | `(index: number) => number` | `() => 50` | Estimated item size in px |
| `overscan` | `number` | `5` | Items to render beyond the visible area |
| `horizontal` | `boolean` | `false` | Virtualise horizontally (columns) |
| `paddingStart` | `number` | — | Padding before first item |
| `paddingEnd` | `number` | — | Padding after last item |
| `scrollPaddingStart` | `number` | — | Scroll padding for `scrollToIndex` |
| `scrollPaddingEnd` | `number` | — | Scroll padding for `scrollToIndex` |
| `gap` | `number` | — | Gap between items in px |
| `lanes` | `number` | `1` | Lanes for masonry layouts |
| `initialOffset` | `number \| (() => number)` | — | Initial scroll offset |

## `<window-virtualizer>` input reference

Same as `<virtualizer>` except `getScrollElement`, `horizontal`, and
`initialOffset` are not accepted. The scroll element is always `window`,
scrolling is always vertical, and the initial offset is read from
`window.scrollY` automatically.

## SSR note

`<virtualizer>` and `<window-virtualizer>` are client-only tags. The
`<lifecycle>` tag inside them never runs during SSR, so the tag variable
will be empty (`virtualItems: []`, `totalSize: 0`) on the server.

Wrap the tag in `<if=mounted>` (where `mounted` is set by `<lifecycle onMount>`) to
ensure the scroll container exists in the DOM before the virtualizer attaches:

```marko
<let/mounted = false/>
<lifecycle onMount() { mounted = true }/>

<if=mounted>
  <div/scrollEl style="height: 400px; overflow-y: auto">
    <virtualizer|{ virtualItems, totalSize }|
      count=10000
      estimateSize=() => 35
      getScrollElement=scrollEl
    >
      ...
    </virtualizer>
  </div>
</if>
```
