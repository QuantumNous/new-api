---
title: Text Measurement with Pretext
---

[Pretext](https://github.com/chenglou/pretext) is a text measurement and layout library from Cheng Lou. TanStack Virtual still owns scrolling, range calculation, item positioning, and scroll-to behavior; Pretext can own the text-height estimate for rows whose height is mostly determined by wrapped text.

This is useful for chat logs, AI streams, activity feeds, comments, changelogs, notifications, and other text-heavy timelines where DOM measurement creates visible correction work.

## When to use it

Use Pretext when each virtual row's height can be derived from:

- Text content
- The exact canvas font string used by the rendered text
- The available content width
- The rendered line-height
- Matching whitespace, word-break, and letter-spacing settings

Do not make Pretext responsible for rows whose height depends on images, embeds, block markdown, loaded components, or arbitrary CSS layout. For those rows, use `measureElement`, call `resizeItem` when the extra content resolves, or split the text-only and non-text portions into separate sizing paths.

## Install

```sh
npm install @chenglou/pretext
```

## Basic pattern

Cache `prepare()` by text and text-style inputs. Run `layout()` for the current width. When the width, font, line-height, or text options change, reset Virtual's measurements so offsets are recalculated from the new estimates.

```tsx
import { clearCache, layout, prepare } from '@chenglou/pretext'
import { useVirtualizer } from '@tanstack/react-virtual'

const font = '14px Arial'
const lineHeight = 20
const preparedCache = new Map<string, ReturnType<typeof prepare>>()

function getPrepared(row: { id: string; text: string }) {
  const key = `${row.id}:${font}:${row.text}`
  const cached = preparedCache.get(key)

  if (cached) {
    return cached
  }

  const prepared = prepare(row.text, font, {
    whiteSpace: 'pre-wrap',
    letterSpacing: 0,
  })
  preparedCache.set(key, prepared)
  return prepared
}

function estimateRowHeight(row: { id: string; text: string }, contentWidth: number) {
  const text = layout(getPrepared(row), contentWidth, lineHeight)
  const textHeight = Math.max(lineHeight, text.height)

  return textHeight + 24
}

function Messages({ rows }: { rows: Array<{ id: string; text: string }> }) {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const [width, setWidth] = React.useState(640)

  React.useLayoutEffect(() => {
    const element = parentRef.current

    if (!element) {
      return
    }

    const update = () => setWidth(element.clientWidth)
    const observer = new ResizeObserver(update)

    update()
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getItemKey: (index) => rows[index]!.id,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => estimateRowHeight(rows[index]!, width - 32),
  })

  React.useLayoutEffect(() => {
    virtualizer.measure()
  }, [virtualizer, width])

  React.useEffect(() => {
    document.fonts.ready.then(() => {
      preparedCache.clear()
      clearCache()
      virtualizer.measure()
    })
  }, [virtualizer])

  return <div ref={parentRef}>{/* render virtual rows */}</div>
}
```

## Robustness checklist

- Match CSS and Pretext inputs exactly. `font`, `line-height`, `letter-spacing`, `white-space`, and `word-break` must agree with the rendered row.
- Prefer named fonts. System font aliases can map differently between CSS and canvas, especially on macOS.
- Wait for fonts before trusting cached measurements. After `document.fonts.ready`, clear your prepared-text cache, call Pretext's `clearCache()`, and call `virtualizer.measure()`.
- Rerun `layout()`, not `prepare()`, on resize. `prepare()` is the expensive per-text setup; `layout()` is the cheap width-dependent path.
- Clamp empty text if your UI renders empty rows as one line. Pretext returns zero height for an empty string.
- Use one sizing owner per row. Do not call `measureElement` for the same row that you also size with `resizeItem` or Pretext estimates unless you deliberately want DOM measurement to override the text estimate.
- Keep a fallback for unsupported runtimes. Pretext currently needs `Intl.Segmenter` and Canvas 2D text measurement.
- Use `resizeItem(index, size)` when you know a row's final size outside render, such as after markdown preprocessing, image metadata loading, or a controlled expand/collapse transition.

See the React Pretext example for a complete chat-style implementation: [React Pretext](./framework/react/examples/pretext).
