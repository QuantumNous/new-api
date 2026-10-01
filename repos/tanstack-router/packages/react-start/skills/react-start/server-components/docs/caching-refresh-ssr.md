# Caching, refresh, SSR modes, and loading patterns

## Pick one cache owner first

### Router cache

Use Router when the RSC is route-shaped and keyed by URL state.

Relevant facts:

- Router loader cache keys are based on pathname and params, plus anything you add through `loaderDeps`
- default navigation `staleTime` is `0`
- default preload freshness is `30s`
- default stale reload mode is background stale-while-revalidate
- `router.invalidate()` reloads active loaders immediately and marks cached routes stale

Use Router ownership when the fragment naturally belongs to the route and should track navigation.

### TanStack Query

Use Query when the fragment has its own lifecycle.

Typical reasons:

- reuse across routes
- background refetching independent of navigation
- manual query invalidation
- non-route ownership

Hard rule:

```tsx
structuralSharing: false
```

Without that, Query may try to merge RSC values across fetches.

### HTTP / server cache

Use GET server functions and response headers when you want cross-request reuse:

- CDN caching
- edge caching
- reverse proxies
- shared server caches

Set headers in a GET `createServerFn` via `setResponseHeaders(...)`.

## Router-owned RSC pattern

Use a server function to return the RSC, then fetch it in the route loader.

Tune Router with:

- `staleTime` when revisits should stay fresh for a window
- `loaderDeps` when search params affect the fragment
- `staleReloadMode: 'blocking'` when showing stale data during reload is unacceptable

`loaderDeps` rule: include only values the loader actually uses. Returning the whole search object causes noisy invalidation.

## Query-owned RSC pattern

Use Query when you want explicit cache keys and background fetch behavior.

Recommended shape:

```tsx
const postQueryOptions = (postId: string) => ({
  queryKey: ['post-rsc', postId],
  structuralSharing: false,
  queryFn: () => getPostRsc({ data: { postId } }),
  staleTime: 5 * 60 * 1000,
})
```

For SSR reuse, prefetch in the route loader:

```tsx
await context.queryClient.ensureQueryData(postQueryOptions(params.postId))
```

Then read it with `useSuspenseQuery` in the component.

## Refresh rules

- loader-owned fragment changed -> `router.invalidate()`
- query-owned fragment changed -> `queryClient.invalidateQueries(...)`
- shared route and query state -> refresh both if both are authoritative
- CDN or response-header cache involved -> make sure the mutation path also busts or bypasses server-side cache

Do not “spray” invalidation everywhere. Decide who owns freshness, then target that owner.

## Selective SSR modes

### `ssr: 'data-only'`

Use when:

- the route component needs browser APIs
- the loader can still fetch the RSC on the server for first paint
- you want server-fetched fragment data ready before the client component mounts

This is often the right shape for responsive charts, viewport-dependent layout wrappers, or widgets that need `window` but still benefit from server-rendered content.

### `ssr: false`

Use when the loader itself depends on browser APIs such as:

- `localStorage`
- `window`
- browser-only client state

In this mode, both the loader and component run in the browser. The loader can still call a server function that returns an RSC.

## Loading patterns

### Independent fragments -> parallel

If the fragments do not share data, fetch them with separate server functions and `Promise.all`.

### Shared data or shared invalidation -> bundle

If several fragments always share a fetch or invalidate together, return them from one server function. This reduces round trips and keeps ownership aligned.

### One slow fragment should not block everything -> defer

Return promises from the loader instead of awaiting them. Resolve them with `use()` inside Suspense. This also lets you isolate failures with a local ErrorBoundary instead of the route error boundary.

### Large or unbounded lists -> async generators

Use async generators when items should arrive incrementally and total size or per-item latency is unpredictable.

## Request-scoped memoization

`React.cache` works inside server components. Use it when several async server components in one request need the same expensive fetch or computation.

That is request-scoped deduplication, not a cross-request cache.
