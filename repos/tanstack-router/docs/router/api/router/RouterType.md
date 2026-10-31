---
id: RouterType
title: Router type
---

The `Router` type is used to describe a router instance.

## `Router` properties and methods

An instance of the `Router` has the following properties and methods:

### `.update` method

- Type: `(newOptions: RouterOptions) => void`
- Updates the router instance with new options.

### `state` property

- Type: [`RouterState`](./RouterStateType.md)
- The current state of the router.

> ⚠️⚠️⚠️ **`router.state` is always up to date, but NOT REACTIVE. If you use `router.state` in a component, the component will not re-render when the router state changes. To get a reactive version of the router state, use the [`useRouterState`](./useRouterStateHook.md) hook.**

### `.subscribe` method

- Type: `(eventType: TType, fn: ListenerFn<RouterEvents[TType]>) => () => void`
- Subscribes to a [`RouterEvent`](./RouterEventsType.md).
- Returns a function that can be used to unsubscribe from the event.
- The listener will be called with the event payload whenever that event is emitted.
- See the [Router Events guide](../../guide/router-events.md) for lifecycle ordering and usage patterns.

### `.matchRoutes` method

- Type: `(pathname: string, locationSearch?: Record<string, any>, opts?: { throwOnError?: boolean; }) => RouteMatch[]`
- Matches a pathname and search params against the router's route tree and returns an array of route matches.
- If `opts.throwOnError` is `true`, any errors that occur during the matching process will be thrown (in addition to being returned in the route match's `error` property).

### `.cancelMatch` method

- Type: `(matchId: string) => void`
- Cancels a route match that is currently pending by calling `match.abortController.abort()`.

### `.cancelMatches` method

- Type: `() => void`
- Cancels all route matches that are currently pending by calling `match.abortController.abort()` on each one.

### `.buildLocation` method

Builds a new parsed location object that can be used later to navigate to a new location.

- Type: `(opts: BuildNextOptions) => ParsedLocation`
- Properties
  - `from`
    - Type: `string`
    - Optional
    - The path to navigate from. If not provided, the current path will be used.
  - `to`
    - Type: `string | number | null`
    - Optional
    - The path to navigate to. If `null`, the current path will be used.
  - `params`
    - Type: `true | Updater<unknown>`
    - Optional
    - If `true`, the current params will be used. If a function is provided, it will be called with the current params and the return value will be used.
  - `search`
    - Type: `true | Updater<unknown>`
    - Optional
    - If `true`, the current search params will be used. If a function is provided, it will be called with the current search params and the return value will be used.
  - `hash`
    - Type: `true | Updater<string>`
    - Optional
    - If `true`, the current hash will be used. If a function is provided, it will be called with the current hash and the return value will be used.
  - `state`
    - Type: `true | NonNullableUpdater<ParsedHistoryState, HistoryState>`
    - Optional
    - If `true`, the current state will be used. If a function is provided, it will be called with the current state and the return value will be used.
  - `mask`
    - Type: `object`
    - Optional
    - Contains all of the same BuildNextOptions, with the addition of `unmaskOnReload`.
    - `unmaskOnReload`
      - Type: `boolean`
      - Optional
      - If `true`, the route mask will be removed when the page is reloaded. This can be overridden on a per-navigation basis by setting `mask.unmaskOnReload` in [`NavigateOptions`](./NavigateOptionsType.md).

### `.commitLocation` method

Commits a new location object to the browser history.

- Type
  ```tsx
  type commitLocation = (
    location: ParsedLocation & {
      replace?: boolean
      resetScroll?: boolean
      hashScrollIntoView?: boolean | ScrollIntoViewOptions
      ignoreBlocker?: boolean
    },
  ) => Promise<void>
  ```
- Properties
  - `location`
    - Type: [`ParsedLocation`](./ParsedLocationType.md)
    - Required
    - The location to commit to the browser history.
  - `replace`
    - Type: `boolean`
    - Optional
    - Defaults to `false`.
    - If `true`, the location will be committed to the browser history using `history.replace` instead of `history.push`.
  - `resetScroll`
    - Type: `boolean`
    - Optional
    - Defaults to `true` so that the scroll position will be reset to 0,0 after the location is committed to the browser history.
    - If `false`, the scroll position will not be reset to 0,0 after the location is committed to history.
  - `hashScrollIntoView`
    - Type: `boolean | ScrollIntoViewOptions`
    - Optional
    - Defaults to `true` so the element with an id matching the hash will be scrolled into view after the location is committed to history.
    - If `false`, the element with an id matching the hash will not be scrolled into view after the location is committed to history.
    - If an object is provided, it will be passed to the `scrollIntoView` method as options.
    - See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) for more information on `ScrollIntoViewOptions`.
  - `ignoreBlocker`
    - Type: `boolean`
    - Optional
    - Defaults to `false`.
    - If `true`, navigation will ignore any blockers that might prevent it.

### `.navigate` method

Navigates to a new location.

- Type
  ```tsx
  type navigate = (options: NavigateOptions) => Promise<void>
  ```

### `.invalidate` method

Invalidates route matches by forcing their `beforeLoad` and `load` functions to be called again.

- Type: `(opts?: {filter?: (d: MakeRouteMatchUnion<TRouter>) => boolean, sync?: boolean, forcePending?: boolean }) => Promise<void>`
- This is useful any time your loader data might be out of date or stale. For example, if you have a route that displays a list of posts, and you have a loader function that fetches the list of posts from an API, you might want to invalidate the route matches for that route any time a new post is created so that the list of posts is always up-to-date.
- if `filter` is not supplied, all matches will be invalidated
- if `filter` is supplied, only matches for which `filter` returns `true` will be invalidated.
- if `sync` is true, the promise returned by this function will only resolve once all loaders have finished.
- if `forcePending` is true, the invalidated matches will be put into `'pending'` state regardless whether they are in `'error'` state or not.
- You might also want to invalidate the Router if you imperatively `reset` the router's `CatchBoundary` to trigger loaders again.

### `.clearCache` method

Remove cached route matches.

- Type: `(opts?: {filter?: (d: MakeRouteMatchUnion<TRouter>) => boolean}) => void`
- if `filter` is not supplied, all cached matches will be removed
- if `filter` is supplied, only matches for which `filter` returns `true` will be removed.

### `.load` method

Loads all of the currently matched route matches and resolves when they are all loaded and ready to be rendered.

> ⚠️⚠️⚠️ **`router.load()` respects `route.staleTime`: fresh matches stay fresh, but stale matches are revalidated even if their loader key did not change. If you need to forcefully reload all active matches regardless of freshness, use `router.invalidate()` instead.**

- Type: `(opts?: {sync?: boolean}) => Promise<void>`
- if `sync` is true, the promise returned by this function will only resolve once all loaders have finished.
- The most common use case for this method is to call it when doing SSR to ensure that all of the critical data for the current route is loaded before attempting to stream or render the application to the client.

### `.preloadRoute` method

Preloads all of the matches that match the provided `NavigateOptions`.

> ⚠️⚠️⚠️ **Preloaded route matches are not stored long-term in the router state. They are only stored until the next attempted navigation action.**

- Type: `(opts?: NavigateOptions) => Promise<RouteMatch[]>`
- Properties
  - `opts`
    - Type: `NavigateOptions`
    - Optional, defaults to the current location.
    - The options that will be used to determine which route matches to preload.
- Returns
  - A promise that resolves with an array of all of the route matches that were preloaded.

### `.loadRouteChunk` method

Loads the JS chunk of the route.

- Type: `(route: AnyRoute) => Promise<void>`

### `.matchRoute` method

Matches a pathname and search params against the router's route tree and returns a route match's params or false if no match was found.

- Type: `(dest: ToOptions, matchOpts?: MatchRouteOptions) => RouteMatch['params'] | false`
- Properties
  - `dest`
    - Type: `ToOptions`
    - Required
    - The destination to match against.
  - `matchOpts`
    - Type: `MatchRouteOptions`
    - Optional
    - Options that will be used to match the destination.
- Returns
  - A route match's params if a match was found.
  - `false` if no match was found.

### `.dehydrate` method

Dehydrates the router's critical state into a serializable object that can be sent to the client in an initial request.

- Type: `() => DehydratedRouter`
- Returns
  - A serializable object that contains the router's critical state.

### `.hydrate` method

Hydrates the router's critical state from a serializable object that was sent from the server in an initial request.

- Type: `(dehydrated: DehydratedRouter) => void`
- Properties
  - `dehydrated`
    - Type: `DehydratedRouter`
    - Required
    - The dehydrated router state that was sent from the server.
