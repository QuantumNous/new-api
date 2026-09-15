---
title: Angular Virtual
---

The `@tanstack/angular-virtual` adapter is a wrapper around the core virtual logic.

Angular Virtual supports Angular 19 and newer. In practice, the adapter is intended to support Angular LTS releases and newer.

## `injectVirtualizer`

```ts
function injectVirtualizer<TScrollElement, TItemElement = unknown>(
  options: PartialKeys<
    Omit<VirtualizerOptions<TScrollElement, TItemElement>, 'getScrollElement'>,
    'observeElementRect' | 'observeElementOffset' | 'scrollToFn'
  > & { scrollElement: ElementRef<TScrollElement> | TScrollElement | undefined },
): AngularVirtualizer<TScrollElement, TItemElement>
```

This function returns an `AngularVirtualizer` instance configured to work with an HTML element as the scrollElement.
The returned `AngularVirtualizer` mirrors the core `Virtualizer`, but adapter-managed state is exposed through Angular signals. This includes:

- `getTotalSize`
- `getVirtualItems`
- `isScrolling`
- `options`
- `range`
- `scrollDirection`
- `scrollElement`
- `scrollOffset`
- `scrollRect`
- `measurementsCache`

## `injectWindowVirtualizer`

```ts
function injectWindowVirtualizer<TItemElement = unknown>(
  options: PartialKeys<
    VirtualizerOptions<Window, TItemElement>,
    | 'getScrollElement'
    | 'observeElementRect'
    | 'observeElementOffset'
    | 'scrollToFn'
  >,
): AngularVirtualizer<Window, TItemElement>
```

This function returns a window-based `AngularVirtualizer` instance configured to work with the window as the scrollElement.
