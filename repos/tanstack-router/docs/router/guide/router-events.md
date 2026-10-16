---
title: Router Events
---

TanStack Router exposes router lifecycle events through `router.subscribe`. This is useful for imperative side effects like analytics, resetting external state, or running DOM-dependent logic after navigation.

## Basic usage

`router.subscribe` takes an event name and a listener, then returns an unsubscribe function:

```tsx
const unsubscribe = router.subscribe('onResolved', (event) => {
  console.info('Navigation finished:', event.toLocation.href)
})

// Later, clean up the listener
unsubscribe()
```

## When to use it

`router.subscribe` is best for imperative integrations that need to observe navigation without driving rendering:

- Analytics and pageview tracking
- Resetting external caches or mutation state
- Logging navigation timing and transitions
- Running DOM-dependent logic after routes render

If you need reactive UI updates, prefer framework hooks like `useRouterState`, `useSearch`, and `useParams` instead of subscribing manually.

## Available events

TanStack Router emits these lifecycle events:

- `onBeforeNavigate` - right before a navigation begins
- `onBeforeLoad` - before route loading starts
- `onLoad` - after the next location has committed and route matches have loaded
- `onBeforeRouteMount` - after loading finishes, just before route components mount
- `onResolved` - after the navigation has fully resolved
- `onRendered` - after the route has rendered

For the full event payload types, see the [`RouterEvents` type](../api/router/RouterEventsType.md).

## Typical event flow

For a normal navigation, the events usually flow like this:

1. `onBeforeNavigate`
2. `onBeforeLoad`
3. `onLoad`
4. `onBeforeRouteMount`
5. `onResolved`
6. `onRendered`

You usually do not need every event. A good rule of thumb is:

- Use `onBeforeNavigate` or `onBeforeLoad` to observe navigation start
- Use `onResolved` for analytics and cleanup after navigation finishes
- Use `onRendered` for DOM-dependent work

## Event payload

Navigation events receive location change metadata describing what changed:

```tsx
const unsubscribe = router.subscribe('onBeforeNavigate', (event) => {
  console.info({
    from: event.fromLocation?.href,
    to: event.toLocation.href,
    pathChanged: event.pathChanged,
    hrefChanged: event.hrefChanged,
    hashChanged: event.hashChanged,
  })
})
```

A few useful details:

- `fromLocation` can be `undefined` on the initial load
- `pathChanged` tells you whether the pathname changed
- `hrefChanged` includes pathname, search, and hash changes
- `hashChanged` is useful for distinguishing hash-only navigations

## Common patterns

### Track pageviews

`onResolved` is a good default for analytics because it fires after navigation finishes:

```tsx
const unsubscribe = router.subscribe('onResolved', ({ toLocation }) => {
  analytics.track('page_view', {
    path: toLocation.pathname,
    href: toLocation.href,
  })
})
```

### Clear external mutation state

If you use a mutation library without keyed mutation state, clear it after navigation:

```tsx
const unsubscribe = router.subscribe('onResolved', ({ pathChanged }) => {
  if (pathChanged) {
    mutationCache.clear()
  }
})
```

### Run DOM-dependent logic

Use `onRendered` when your side effect depends on the new route content already being in the DOM:

```tsx
const unsubscribe = router.subscribe('onRendered', ({ toLocation }) => {
  focusPageHeading(toLocation.pathname)
})
```

## Unsubscribing in components

If you subscribe from a component or framework effect, always return the unsubscribe function from your cleanup so the listener is removed when the component unmounts.

## Related APIs

- [`Router` type](../api/router/RouterType.md)
- [`RouterEvents` type](../api/router/RouterEventsType.md)
- [Data Mutations](./data-mutations.md)
