---
id: RouterOptions
title: RouterOptions
---

The `RouterOptions` type contains all of the options that can be used to configure a router instance.

## RouterOptions properties

The `RouterOptions` type accepts an object with the following properties and methods:

### `routeTree` property

- Type: `AnyRoute`
- Required
- The route tree that will be used to configure the router instance.

### `history` property

- Type: `RouterHistory`
- Optional
- The history object that will be used to manage the browser history. If not provided, a new `createBrowserHistory` instance will be created and used.

### `stringifySearch` method

- Type: `(search: Record<string, any>) => string`
- Optional
- A function that will be used to stringify search params when generating links.
- Defaults to `defaultStringifySearch`.

### `parseSearch` method

- Type: `(search: string) => Record<string, any>`
- Optional
- A function that will be used to parse search params when parsing the current location.
- Defaults to `defaultParseSearch`.

### `search.strict` property

- Type: `boolean`
- Optional
- Defaults to `false`
- Configures how unknown search params (= not returned by any `validateSearch`) are treated.
- If `false`, unknown search params will be kept.
- If `true`, unknown search params will be removed.

### `defaultPreload` property

- Type: `undefined | false | 'intent' | 'viewport' | 'render'`
- Optional
- Defaults to `false`
- If `false`, routes will not be preloaded by default in any way.
- If `'intent'`, routes will be preloaded by default when the user hovers over a link or a `touchstart` event is detected on a `<Link>`.
- If `'viewport'`, routes will be preloaded by default when they are within the viewport of the browser.
- If `'render'`, routes will be preloaded by default as soon as they are rendered in the DOM.

### `defaultPreloadDelay` property

- Type: `number`
- Optional
- Defaults to `50`
- The delay in milliseconds that a route must be hovered over or touched before it is preloaded.

### `defaultComponent` property

- Type: `RouteComponent`
- Optional
- Defaults to `Outlet`
- The default `component` a route should use if no component is provided.

### `defaultErrorComponent` property

- Type: `RouteComponent`
- Optional
- Defaults to `ErrorComponent`
- The default `errorComponent` a route should use if no error component is provided.

### `defaultNotFoundComponent` property

- Type: `NotFoundRouteComponent`
- Optional
- Defaults to `NotFound`
- The default `notFoundComponent` a route should use if no notFound component is provided.

### `defaultPendingComponent` property

- Type: `RouteComponent`
- Optional
- The default `pendingComponent` a route should use if no pending component is provided.

### `defaultPendingMs` property

- Type: `number`
- Optional
- Defaults to `1000`
- The default `pendingMs` a route should use if no pendingMs is provided.

### `defaultPendingMinMs` property

- Type: `number`
- Optional
- Defaults to `500`
- The default `pendingMinMs` a route should use if no pendingMinMs is provided.

### `defaultStaleTime` property

- Type: `number`
- Optional
- Defaults to `0`
- The default `staleTime` a route should use if no staleTime is provided.

### `defaultStaleReloadMode` property

- Type: `'background' | 'blocking'`
- Optional
- Defaults to `'background'`
- Controls how stale successful loader data is revalidated by default.
- `'background'` preserves stale-while-revalidate behavior.
- `'blocking'` waits for the stale loader reload to finish before navigation resolves.

### `defaultPreloadStaleTime` property

- Type: `number`
- Optional
- Defaults to `30_000` ms (30 seconds)
- The default `preloadStaleTime` a route should use if no preloadStaleTime is provided.

### `defaultPreloadGcTime` property

- Type: `number`
- Optional
- Defaults to `routerOptions.defaultGcTime`, which defaults to 30 minutes.
- The default `preloadGcTime` a route should use if no preloadGcTime is provided.

### `defaultGcTime` property

- Type: `number`
- Optional
- Defaults to 30 minutes.
- The default `gcTime` a route should use if no gcTime is provided.

### `defaultOnCatch` property

- Type: `(error: Error, errorInfo: ErrorInfo) => void`
- Optional
- The default `onCatch` handler for errors caught by the Router ErrorBoundary

### `disableGlobalCatchBoundary` property

- Type: `boolean`
- Optional
- Defaults to `false`
- When `true`, disables the global catch boundary that normally wraps all route matches. This allows unhandled errors to bubble up to top-level error handlers in the browser.
- Useful for testing tools, error reporting services, and debugging scenarios.

### `protocolAllowlist` property

- Type: `Array<string>`
- Optional
- Defaults to `DEFAULT_PROTOCOL_ALLOWLIST` which includes:
  - Web navigation: `http:`, `https:`
  - Common browser-safe actions: `mailto:`, `tel:`
- An array of URL protocols that are allowed in links, redirects, and navigation. Absolute URLs with protocols not in this list are rejected to prevent security vulnerabilities like XSS attacks.
- This check is applied across router navigation APIs, including:
  - `<Link to="...">`
  - `navigate({ to: ... })` and `navigate({ href: ... })`
  - `redirect({ to: ... })` and `redirect({ href: ... })`
- Protocol entries must match `URL.protocol` format (lowercase with a trailing `:`), for example `blob:` or `data:`. If you configure `protocolAllowlist: ['blob']` (without `:`), links using `blob:` will still be blocked.

**Example**

```tsx
import {
  createRouter,
  DEFAULT_PROTOCOL_ALLOWLIST,
} from '@tanstack/react-router'

// Use a custom allowlist (replaces the default)
const router = createRouter({
  routeTree,
  protocolAllowlist: ['https:', 'mailto:'],
})

// Or extend the default allowlist
const router = createRouter({
  routeTree,
  protocolAllowlist: [...DEFAULT_PROTOCOL_ALLOWLIST, 'ftp:'],
})
```

### `defaultViewTransition` property

- Type: `boolean | ViewTransitionOptions`
- Optional
- If `true`, route navigations will be called using `document.startViewTransition()`.
- If [`ViewTransitionOptions`](./ViewTransitionOptionsType.md), route navigations will be called using `document.startViewTransition({update, types})`
  where `types` will be the strings array passed with `ViewTransitionOptions["types"]`. If the browser does not support viewTransition types,
  the navigation will fall back to normal `document.startTransition()`, same as if `true` was passed.
- If the browser does not support this api, this option will be ignored.
- See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) for more information on how this function works.
- See [Google](https://developer.chrome.com/docs/web-platform/view-transitions/same-document#view-transition-types) for more information on viewTransition types

### `defaultHashScrollIntoView` property

- Type: `boolean | ScrollIntoViewOptions`
- Optional
- Defaults to `true` so the element with an id matching the hash will be scrolled into view after the location is committed to history.
- If `false`, the element with an id matching the hash will not be scrolled into view after the location is committed to history.
- If an object is provided, it will be passed to the `scrollIntoView` method as options.
- See [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView) for more information on `ScrollIntoViewOptions`.

### `caseSensitive` property

- Type: `boolean`
- Optional
- Defaults to `false`
- If `true`, all routes will be matched as case-sensitive.

### `basepath` property

- Type: `string`
- Optional
- Defaults to `/`
- The basepath for the entire router. This is useful for mounting a router instance at a subpath.

### `rewrite` property

- Type: `LocationRewrite`
- Optional
- Configures bidirectional URL transformation between the browser URL and the router's internal URL.
- See the [URL Rewrites guide](../../guide/url-rewrites.md) for detailed usage and patterns.

The `LocationRewrite` type has the following shape:

```tsx
type LocationRewrite = {
  input?: LocationRewriteFunction
  output?: LocationRewriteFunction
}

type LocationRewriteFunction = (opts: { url: URL }) => undefined | string | URL
```

- `input`: Transforms the URL before the router interprets it (browser → router)
- `output`: Transforms the URL before it's written to browser history (router → browser)

**Example**

```tsx
import { createRouter } from '@tanstack/react-router'

const router = createRouter({
  routeTree,
  rewrite: {
    input: ({ url }) => {
      // Strip locale prefix: /en/about → /about
      if (url.pathname.startsWith('/en')) {
        url.pathname = url.pathname.replace(/^\/en/, '') || '/'
      }
      return url
    },
    output: ({ url }) => {
      // Add locale prefix: /about → /en/about
      url.pathname = `/en${url.pathname === '/' ? '' : url.pathname}`
      return url
    },
  },
})
```

When both `basepath` and `rewrite` are configured, they are automatically composed. The basepath rewrite runs first on input (stripping the basepath) and last on output (adding it back).

### `context` property

- Type: `any`
- Optional or required if the root route was created with [`createRootRouteWithContext()`](./createRootRouteWithContextFunction.md).
- The root context that will be provided to all routes in the route tree. This can be used to provide a context to all routes in the tree without having to provide it to each route individually.

### `dehydrate` method

- Type: `() => TDehydrated`
- Optional
- A function that will be called when the router is dehydrated. The return value of this function will be serialized and stored in the router's dehydrated state.

### `hydrate` method

- Type: `(dehydrated: TDehydrated) => void`
- Optional
- A function that will be called when the router is hydrated. The return value of this function will be serialized and stored in the router's dehydrated state.

### `routeMasks` property

- Type: `RouteMask[]`
- Optional
- An array of route masks that will be used to mask routes in the route tree. Route masking is when you display a route at a different path than the one it is configured to match, like a modal popup that when shared will unmask to the modal's content instead of the modal's context.

### `unmaskOnReload` property

- Type: `boolean`
- Optional
- Defaults to `false`
- If `true`, route masks will, by default, be removed when the page is reloaded. This can be overridden on a per-mask basis by setting `unmaskOnReload` on the mask, or on a per-navigation basis by setting `mask.unmaskOnReload` in [`NavigateOptions`](./NavigateOptionsType.md).

### `Wrap` property

- Type: `React.Component`
- Optional
- A component that will be used to wrap the entire router. This is useful for providing a context to the entire router. Only non-DOM-rendering components like providers should be used, anything else will cause a hydration error.

**Example**

```tsx
import { createRouter } from '@tanstack/react-router'

const router = createRouter({
  // ...
  Wrap: ({ children }) => {
    return <MyContext.Provider value={myContext}>{children}</MyContext>
  },
})
```

### `InnerWrap` property

- Type: `React.Component`
- Optional
- A component that will be used to wrap the inner contents of the router. This is useful for providing a context to the inner contents of the router where you also need access to the router context and hooks. Only non-DOM-rendering components like providers should be used, anything else will cause a hydration error.

**Example**

```tsx
import { createRouter } from '@tanstack/react-router'

const router = createRouter({
  // ...
  InnerWrap: ({ children }) => {
    const routerState = useRouterState()

    return (
      <MyContext.Provider value={myContext}>
        {children}
      </MyContext>
    )
  },
})
```

### `notFoundMode` property

- Type: `'root' | 'fuzzy'`
- Optional
- Defaults to `'fuzzy'`
- This property controls how TanStack Router will handle scenarios where it cannot find a route to match the current location. See the [Not Found Errors guide](../../guide/not-found-errors.md) for more information.

### `notFoundRoute` property

- **Deprecated**
- Type: `NotFoundRoute`
- Optional
- A route that will be used as the default not found route for every branch of the route tree. This can be overridden on a per-branch basis by providing a not found route to the `NotFoundRoute` option on the root route of the branch.

### `trailingSlash` property

- Type: `'always' | 'never' | 'preserve'`
- Optional
- Defaults to `never`
- Configures how trailing slashes are treated. `'always'` will add a trailing slash if not present, `'never'` will remove the trailing slash if present and `'preserve'` will not modify the trailing slash.

### `pathParamsAllowedCharacters` property

- Type: `Array<';' | ':' | '@' | '&' | '=' | '+' | '$' | ','>`
- Optional
- Configures which URI characters are allowed in path params that would ordinarily be escaped by encodeURIComponent.

### `defaultStructuralSharing` property

- Type: `boolean`
- Optional
- Defaults to `false`
- Configures whether structural sharing is enabled by default for fine-grained selectors.
- See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.

### `defaultRemountDeps` property

- Type:

```tsx
type defaultRemountDeps = (opts: RemountDepsOptions) => any

interface RemountDepsOptions<
  in out TRouteId,
  in out TFullSearchSchema,
  in out TAllParams,
  in out TLoaderDeps,
> {
  routeId: TRouteId
  search: TFullSearchSchema
  params: TAllParams
  loaderDeps: TLoaderDeps
}
```

- Optional
- A default function that will be called to determine whether a route component shall be remounted after navigation. If this function returns a different value than previously, it will remount.
- The return value needs to be JSON serializable.
- By default, a route component will not be remounted if it stays active after a navigation

Example:  
If you want to configure to remount all route components upon `params` change, use:

```tsx
remountDeps: ({ params }) => params
```
