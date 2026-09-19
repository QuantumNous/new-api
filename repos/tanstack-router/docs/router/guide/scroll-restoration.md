---
id: scroll-restoration
title: Scroll Restoration
---

## Hash/Top-of-Page Scrolling

Out of the box, TanStack Router supports both **hash scrolling** and **top-of-page scrolling** without any additional configuration.

## Scroll-to-top & Nested Scrollable Areas

By default, scroll-to-top mimics the behavior of the browser, which means only the `window` itself is scrolled to the top after successful navigation. For many apps however, it's common for the main scrollable area to be a nested div or similar because of advanced layouts. If you would like TanStack Router to also scroll these main scrollable areas for you, you can add selectors to target them using the `routerOptions.scrollToTopSelectors`:

```tsx
const router = createRouter({
  scrollToTopSelectors: ['#main-scrollable-area'],
})
```

For complex selectors that cannot be simply resolved using `document.querySelector(selector)`, you can pass functions that return HTML elements to `routerOptions.scrollToTopSelectors`:

```tsx
const selector = () =>
  document
    .querySelector('#shadowRootParent')
    ?.shadowRoot?.querySelector('#main-scrollable-area')

const router = createRouter({
  scrollToTopSelectors: [selector],
})
```

These selectors are handled **in addition to `window`** which cannot be disabled currently.

## Scroll Restoration

Scroll restoration is the process of restoring the scroll position of a page when the user navigates back to it. This is normally a built-in feature for standard HTML based websites, but can be difficult to replicate for SPA applications because:

- SPAs typically use the `history.pushState` API for navigation, so the browser doesn't know to restore the scroll position natively
- SPAs sometimes render content asynchronously, so the browser doesn't know the height of the page until after it's rendered
- SPAs can sometimes use nested scrollable containers to force specific layouts and features.

Not only that, but it's very common for applications to have multiple scrollable areas within an app, not just the body. For example, a chat application might have a scrollable sidebar and a scrollable chat area. In this case, you would want to restore the scroll position of both areas independently.

To alleviate this problem, TanStack Router provides a scroll restoration component and hook that handle the process of monitoring, caching and restoring scroll positions for you.

It does this by:

- Monitoring the DOM for scroll events
- Registering scrollable areas with the scroll restoration cache
- Listening to the proper router events to know when to cache and restore scroll positions
- Storing scroll positions for each scrollable area in the cache (including `window` and `body`)
- Restoring scroll positions after successful navigations before DOM paint

That may sound like a lot, but for you, it's as simple as this:

```tsx
const router = createRouter({
  scrollRestoration: true,
})
```

> [!NOTE]
> The `<ScrollRestoration />` component still works, but has been deprecated.

## Custom Cache Keys

Falling in behind Remix's own Scroll Restoration APIs, you can also customize the key used to cache scroll positions for a given scrollable area using the `getKey` option. This could be used, for example, to force the same scroll position to be used regardless of the users browser history.

The `getKey` option receives the relevant `Location` state from TanStack Router and expects you to return a string to uniquely identify the scrollable measurements for that state.

The default `getKey` is `(location) => location.state.__TSR_key!`, where `__TSR_key` is the unique key generated for each entry in the history.

> Older versions, prior to `v1.121.34`, used `state.key` as the default key, but this has been deprecated in favor of `state.__TSR_key`. For now, `location.state.key` will still be available for compatibility, but it will be removed in the next major version.

## Examples

You could sync scrolling to the pathname:

```tsx
const router = createRouter({
  getScrollRestorationKey: (location) => location.pathname,
})
```

You can conditionally sync only some paths, then use the key for the rest:

```tsx
const router = createRouter({
  getScrollRestorationKey: (location) => {
    const paths = ['/', '/chat']
    return paths.includes(location.pathname)
      ? location.pathname
      : location.state.__TSR_key!
  },
})
```

## Preventing Scroll Restoration

Sometimes you may want to prevent scroll restoration from happening. To do this you can utilize the `resetScroll` option available on the following APIs:

- `<Link resetScroll={false}>`
- `navigate({ resetScroll: false })`
- `redirect({ resetScroll: false })`

When `resetScroll` is set to `false`, the scroll position for the next navigation will not be restored (if navigating to an existing history event in the stack) or reset to the top (if it's a new history event in the stack).

## Manual Scroll Restoration

Most of the time, you won't need to do anything special to get scroll restoration to work. However, there are some cases where you may need to manually control scroll restoration. The most common example is **virtualized lists**.

To manually control scroll restoration for virtualized lists within the whole browser window:

```tsx
function Component() {
  const scrollEntry = useElementScrollRestoration({
    getElement: () => window,
  })

  // Let's use TanStack Virtual to virtualize some content!
  const virtualizer = useWindowVirtualizer({
    count: 10000,
    estimateSize: () => 100,
    // We pass the scrollY from the scroll restoration entry to the virtualizer
    // as the initial offset
    initialOffset: scrollEntry?.scrollY,
  })

  return (
    <div>
      {virtualizer.getVirtualItems().map(item => (
        ...
      ))}
    </div>
  )
}
```

To manually control scroll restoration for a specific element, you can use the `useElementScrollRestoration` hook and the `data-scroll-restoration-id` DOM attribute:

<!-- ::start:framework -->

# React

```tsx
function Component() {
  // We need a unique ID for manual scroll restoration on a specific element
  // It should be as unique as possible for this element across your app
  const scrollRestorationId = 'myVirtualizedContent'

  // We use that ID to get the scroll entry for this element
  const scrollEntry = useElementScrollRestoration({
    id: scrollRestorationId,
  })

  // Let's use TanStack Virtual to virtualize some content!
  const virtualizerParentRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: 10000,
    getScrollElement: () => virtualizerParentRef.current,
    estimateSize: () => 100,
    // We pass the scrollY from the scroll restoration entry to the virtualizer
    // as the initial offset
    initialOffset: scrollEntry?.scrollY,
  })

  return (
    <div
      ref={virtualizerParentRef}
      // We pass the scroll restoration ID to the element
      // as a custom attribute that will get picked up by the
      // scroll restoration watcher
      data-scroll-restoration-id={scrollRestorationId}
      className="flex-1 border rounded-lg overflow-auto relative"
    >
      ...
    </div>
  )
}
```

# Solid

```tsx
function Component() {
  // We need a unique ID for manual scroll restoration on a specific element
  // It should be as unique as possible for this element across your app
  const scrollRestorationId = 'myVirtualizedContent'

  // We use that ID to get the scroll entry for this element
  const scrollEntry = useElementScrollRestoration({
    id: scrollRestorationId,
  })

  // Let's use TanStack Virtual to virtualize some content!
  let virtualizerParentRef: any
  const virtualizer = createVirtualizer({
    count: 10000,
    getScrollElement: () => virtualizerParentRef,
    estimateSize: () => 100,
    // We pass the scrollY from the scroll restoration entry to the virtualizer
    // as the initial offset
    initialOffset: scrollEntry?.scrollY,
  })

  return (
    <div
      ref={virtualizerParentRef}
      // We pass the scroll restoration ID to the element
      // as a custom attribute that will get picked up by the
      // scroll restoration watcher
      data-scroll-restoration-id={scrollRestorationId}
      class="flex-1 border rounded-lg overflow-auto relative"
    >
      ...
    </div>
  )
}
```

<!-- ::end:framework -->

## Scroll Behavior

To control the scroll behavior when navigating between pages, you can use the `scrollRestorationBehavior` option. This allows you to make the transition between pages instant instead of a smooth scroll. The global configuration of scroll restoration behavior has the same options as those supported by the browser, which are `smooth`, `instant`, and `auto` (see [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView#behavior) for more information).

```tsx
const router = createRouter({
  scrollRestorationBehavior: 'instant',
})
```
