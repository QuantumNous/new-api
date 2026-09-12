---
name: react-start/server-components
description: >-
  Implement, review, debug, and refactor TanStack Start React Server
  Components in React 19 apps. Use when tasks mention
  @tanstack/react-start/rsc, renderServerComponent,
  createCompositeComponent, CompositeComponent,
  renderToReadableStream, createFromReadableStream, createFromFetch,
  Composite Components, React Flight streams, loader or query owned
  RSC caching, router.invalidate, structuralSharing: false,
  selective SSR, stale names like renderRsc or .validator, or
  migration from Next App Router RSC patterns. Do not use for
  generic SSR or non-TanStack RSC frameworks except brief
  comparison.
type: sub-skill
library: tanstack-start
library_version: '1.166.2'
requires:
  - react-start
  - start-core/server-functions
  - start-core/execution-model
sources:
  - TanStack/router:docs/start/framework/react/guide/server-components.md
  - TanStack/router:docs/start/framework/react/guide/server-functions.md
  - TanStack/router:docs/start/framework/react/guide/execution-model.md
  - TanStack/router:docs/router/guide/data-loading.md
---

# TanStack Start React Server Components

Treat TanStack Start RSCs as fetchable React Flight payloads, not as a framework-owned server tree. Start from data ownership and cache ownership, then choose the smallest RSC primitive that fits.

## When this skill is active

1. Inspect `vite.config.*` for `tanstackStart({ rsc: { enabled: true } })`, `rsc()`, and `viteReact()`.
2. Inspect route files for `loader`, `loaderDeps`, `staleTime`, `ssr`, and `errorComponent`.
3. Inspect server boundaries: `createServerFn`, `createServerOnlyFn`, `.server.*`, and imports from `@tanstack/react-start/server`.
4. Identify the cache owner: Router loader cache, TanStack Query, or HTTP/server cache.
5. Identify the refresh path: `router.invalidate()`, `invalidateQueries`, `refetchQueries`, or GET cache headers.

## Hard invariants

- Route loaders are isomorphic. Do not put DB access, secrets, or Node-only APIs directly in a loader. If the loader itself must use browser APIs, make that route `ssr: false`.
- `renderServerComponent(...)` returns a renderable fragment. It does not support slots.
- `createCompositeComponent(...)` is for server-rendered UI that must accept client-provided `children`, render props, or component props.
- Query-cached RSC values require `structuralSharing: false`.
- Slot payloads are opaque on the server. Do not inspect, map, or clone `props.children`.
- Render-prop and component-slot arguments must stay Flight-serializable.
- Current server function validation API is `.validator(...)`. Older snippets may still show `.validator(...)`; normalize them.
- TanStack custom serialization does not apply inside RSCs yet. Stay inside native Flight-supported values.

## Decide three things immediately

### 1) Transport / composition primitive

- No client slots needed -> `renderServerComponent`
- Client interactivity must be inserted inside server-rendered markup -> `createCompositeComponent` + `<CompositeComponent src={...} />`
- Need custom Flight streaming, API routes, or non-standard transport -> `renderToReadableStream`, `createFromReadableStream`, `createFromFetch`

### 2) Cache owner

- Route-shaped data keyed by pathname, params, or search -> Router cache
- Independent key space, background refetch, or non-route ownership -> TanStack Query
- Cross-request reuse on server or CDN -> GET `createServerFn` + response cache headers and/or external server cache

### 3) Refresh owner

- Router-owned RSC -> `router.invalidate()`
- Query-owned RSC -> `queryClient.invalidateQueries(...)` or `refetchQueries(...)`
- Mixed Router + Query -> invalidate both deliberately; do not assume one refreshes the other

## Pattern chooser

- Simple server fragment in a route loader -> `renderServerComponent`
- Interactive slot inside server markup -> `createCompositeComponent`
- Route component needs browser APIs but loader can still prefetch on the server -> `ssr: 'data-only'`
- Loader itself needs browser APIs -> `ssr: false`
- Route cache key must include search params -> `loaderDeps`
- Query-managed RSC -> `useSuspenseQuery` + SSR `ensureQueryData`
- Multiple independent RSCs -> separate server functions + `Promise.all`
- Multiple RSCs sharing data or invalidating together -> one server function returning many renderables or sources
- Need isolated widget failures or staggered reveal -> return promises from the loader and resolve with `use()` inside Suspense

## Slot choice

- `children`: free-form composition, no server-to-client data flow
- render props: the server must pass serializable data into client-rendered UI
- component props: reusable client slot with a stable typed prop surface
- If you are about to use `Children.map`, `cloneElement`, or inspect `children` on the server, stop and convert it to a render prop

## Review / refactor checklist

- Is the chosen primitive the smallest one that fits?
- Does the loader own the RSC, or should Query own it?
- Are route cache keys complete (`params` + minimal `loaderDeps`)?
- Is invalidation hitting the real cache owner?
- Are query options using `structuralSharing: false` for any RSC value?
- Are mutations explicit `createServerFn({ method: 'POST' })` calls instead of hidden server actions?
- Are server-only imports kept inside server functions or server-only boundaries?
- Are examples using current names (`renderServerComponent`, `.validator`) instead of stale ones?

## Debug fast

- Setup, exports, or stale docs mismatch -> `docs/current-api-notes.md`
- Composite Component design or slot bug -> `docs/composite-components.md`
- Stale data, refetching, loader keys, Query vs Router ownership, or SSR mode -> `docs/caching-refresh-ssr.md`
- Review, refactor, import leaks, error boundaries, or serialization bugs -> `docs/debugging-review.md`
- Architecture and Next/App Router translation -> `docs/architecture.md`

## Copy-paste patterns

- `examples/01-renderable-route-loader.tsx`
- `examples/02-composite-slots.tsx`
- `examples/03-query-owned-rsc.tsx`
- `examples/04-selective-ssr-data-only.tsx`
- `examples/05-ssr-false-browser-loader.tsx`
- `examples/06-low-level-flight-api-route.tsx`

## Default implementation sequence

1. Keep server-only work inside `createServerFn` or `createServerOnlyFn`
2. Return an RSC from the server function
3. Consume it through the route loader unless Query has a clear ownership advantage
4. Add the smallest cache policy that satisfies freshness requirements
5. Wire invalidation exactly once at the real cache owner
6. Escalate to Composite Components only when the client must fill slots
7. Escalate to low-level Flight APIs only when high-level helpers cannot express the transport
