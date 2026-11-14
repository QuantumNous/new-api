---
title: Introduction
---

TanStack Virtual is a headless UI utility for virtualizing long lists of elements in JS/TS, React, Vue, Svelte, Solid, Lit, and Angular. It is not a component therefore does not ship with or render any markup or styles for you. While this requires a bit of markup and styles from you, you will retain 100% control over your styles, design and implementation.

## The Virtualizer

At the heart of TanStack Virtual is the `Virtualizer`. Virtualizers can be oriented on either the vertical (default) or horizontal axes which makes it possible to achieve vertical, horizontal and even grid-like virtualization by combining the two axis configurations together.

For chat, AI streams, logs, and other reverse feeds, see the [Chat guide](chat).

Here is just a quick example of what it looks like to virtualize a long list within a div using TanStack Virtual in React:

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function App() {
  // The scrollable element for your list
  const parentRef = React.useRef(null)

  // The virtualizer
  const rowVirtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 35,
  })

  return (
    <>
      {/* The scrollable element for your list */}
      <div
        ref={parentRef}
        style={{
          height: `400px`,
          overflow: 'auto', // Make it scroll!
        }}
      >
        {/* The large inner element to hold all of the items */}
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Only the visible items in the virtualizer, manually positioned to be in view */}
          {rowVirtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              Row {virtualItem.index}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
```

Let's dig into some more examples!
