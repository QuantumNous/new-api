---
id: NavigateOptionsType
title: NavigateOptions type
---

The `NavigateOptions` type is used to describe the options that can be used when describing a navigation action in TanStack Router.

```tsx
type NavigateOptions = ToOptions & {
  replace?: boolean
  resetScroll?: boolean
  hashScrollIntoView?: boolean | ScrollIntoViewOptions
  viewTransition?: boolean | ViewTransitionOptions
  ignoreBlocker?: boolean
  reloadDocument?: boolean
  href?: string
}
```

## NavigateOptions properties

The `NavigateOptions` object accepts the following properties:

### `replace`

- Type: `boolean`
- Optional
- Defaults to `false`.
- If `true`, the location will be committed to the browser history using `history.replace` instead of `history.push`.

### `resetScroll`

- Type: `boolean`
- Optional
- Defaults to `true` so that the scroll position will be reset to 0,0 after the location is committed to the browser history.
- If `false`, the scroll position will not be reset to 0,0 after the location is committed to history.

### `hashScrollIntoView`

- Type: `boolean | ScrollIntoViewOptions`
- Optional
- Defaults to `true` so the element with an id matching the hash will be scrolled into view after the location is committed to history.
- If `false`, the element with an id matching the hash will not be scrolled into view after the location is committed to history.
- If an object is provided, it will be passed to the `scrollIntoView` method as options.
- See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) for more information on `ScrollIntoViewOptions`.

### `viewTransition`

- Type: `boolean | ViewTransitionOptions`
- Optional
- Defaults to `false`.
- If `true`, navigation will be called using `document.startViewTransition()`.
- If [`ViewTransitionOptions`](./ViewTransitionOptionsType.md), route navigations will be called using `document.startViewTransition({update, types})` where `types` will determine the strings array passed with `ViewTransitionOptions["types"]`. If the browser does not support viewTransition types, the navigation will fall back to normal `document.startTransition()`, same as if `true` was passed.
- If the browser does not support this api, this option will be ignored.
- See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) for more information on how this function works.
- See [Google](https://developer.chrome.com/docs/web-platform/view-transitions/same-document#view-transition-types) for more information on viewTransition types

### `ignoreBlocker`

- Type: `boolean`
- Optional
- Defaults to `false`.
- If `true`, navigation will ignore any blockers that might prevent it.

### `reloadDocument`

- Type: `boolean`
- Optional
- Defaults to `false`.
- If `true`, navigation to a route inside of router will trigger a full page load instead of the traditional SPA navigation.

### `href`

- Type: `string`
- Optional
- This can be used instead of `to` to navigate to a fully built href, e.g. pointing to an external target.

- [`ToOptions`](./ToOptionsType.md)
