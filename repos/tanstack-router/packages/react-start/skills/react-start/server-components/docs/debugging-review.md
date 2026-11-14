# Debugging and review guide

## Triage by failure stage

### 1. Setup / build failure

Likely causes:

- `@vitejs/plugin-rsc` missing
- RSC not enabled in `tanstackStart({ rsc: { enabled: true } })`
- stale example using old exports
- wrong React or Vite baseline

Checks:

- inspect `vite.config.*`
- inspect imports from `@tanstack/react-start/rsc`
- normalize to `renderServerComponent`, `createCompositeComponent`, `CompositeComponent`, `.validator(...)`

### 2. Wrong environment failure

Symptoms:

- DB or secret access explodes on client navigation
- `window` or `localStorage` explodes during SSR
- import protection complaints about server-only code

Likely causes:

- server-only logic placed directly in an isomorphic loader
- browser-only logic used in SSR route/component
- helper referencing `.server` imports outside a recognized server boundary

Fixes:

- move server-only work into `createServerFn` or `createServerOnlyFn`
- use `ssr: 'data-only'` when only the component needs browser APIs
- use `ssr: false` when the loader itself needs browser APIs
- keep server-only imports inside server-only callbacks or files

## Composition / slot bugs

Symptoms:

- child content disappears or cannot be modified
- `Children.map` or `cloneElement` does nothing useful
- component prop slot receives unusable data
- Composite Component seems heavier than necessary

Likely causes:

- trying to inspect server-side slot placeholders
- non-serializable slot args
- using a Composite Component for a fragment that has no slots

Fixes:

- replace child inspection with a render prop
- narrow slot args to serializable values
- demote slotless composites to `renderServerComponent`

## Cache / staleness bugs

Symptoms:

- stale UI after mutation
- route revisits do not refresh when expected
- route refreshes too often
- Query errors or weird object merging on RSC values

Likely causes:

- invalidating the wrong cache owner
- missing or oversized `loaderDeps`
- missing `structuralSharing: false`
- `staleTime` / `staleReloadMode` mismatch with desired UX

Checks:

- decide whether Router or Query owns the fragment
- inspect `loaderDeps` for only the params actually used
- verify Query key includes all real inputs
- verify `structuralSharing: false`
- use `router.invalidate()` only when the loader owns freshness

## Error boundary surprises

Rule:

- awaited loader failure -> route `errorComponent`
- deferred promise failure -> local ErrorBoundary around the deferred read

If a single failing widget should not take down the route, stop awaiting it in the loader.

## Serialization bugs

Symptoms:

- odd runtime decode failures
- slot args rejected or malformed
- custom serializer assumptions fail

Likely causes:

- passing classes, functions, Maps/Sets with custom serialization expectations, or other non-Flight-friendly values
- relying on TanStack custom serialization inside RSCs

Fixes:

- reduce payloads to primitives, Dates, plain objects, arrays, and React elements where appropriate
- pass IDs, not rich server objects, unless they are plain and intentionally serialized

## Import protection and bundling gotchas

- static imports of server functions are safe; the client build gets RPC stubs
- dynamic imports of server functions can cause bundler issues
- dev-mode import protection warnings can be informational because there is no tree-shaking; build output is the authoritative check

## Code review checklist

- correct primitive: renderable vs composite vs low-level stream
- loader is orchestration, not secret storage
- `loaderDeps` only covers actual inputs
- Query-owned RSC uses `structuralSharing: false`
- invalidation targets the real cache owner
- mutations are explicit `POST` server functions
- slot contracts are narrow and serializable
- stale examples normalized to current APIs
- route-level vs component-level error handling matches the UX requirement

## Simplify-first recovery path

When a bug is tangled across Query, Router, Composite Components, and SSR modes:

1. collapse to one route-owned `renderServerComponent`
2. verify the server function and loader path
3. reintroduce Query only if you need independent ownership
4. reintroduce Composite Components only if you need slots
5. reintroduce deferred loading only if you need staggered reveal or isolated failures

This sequence removes entire classes of bugs instead of trying to patch all of them at once.
