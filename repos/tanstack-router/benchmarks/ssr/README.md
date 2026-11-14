# SSR Benchmarks

Cross-framework SSR request-loop benchmarks for:

- `@tanstack/react-start`
- `@tanstack/solid-start`
- `@tanstack/vue-start`

Each benchmark builds a Start app with file-based routes and runs Vitest benches against the built server handler.

## Layout

- `react/` - React Start baseline benchmark + Vitest config
- `solid/` - Solid Start baseline benchmark + Vitest config
- `vue/` - Vue Start baseline benchmark + Vitest config
- `vitest.react.config.ts`, `vitest.solid.config.ts`, `vitest.vue.config.ts` - per-framework aggregate configs that run the baseline first, then scenario projects
- `scenarios/<scenario>/<framework>/` - isolated scenario apps

Scenario app layout:

```text
scenarios/<scenario>/<framework>/
  vite.config.ts
  speed.bench.ts
  tsconfig.json
  src/
    router.tsx
    routes/
    routeTree.gen.ts
```

Each scenario uses one app per framework instead of sharing routes in the baseline app. This keeps route-tree size, middleware, Start options, and generated route trees isolated so one scenario cannot shift another scenario's numbers. The existing baseline apps and bench names stay stable for CodSpeed continuity.

## Scenario Responsibilities

Each scenario isolates one Start server-side responsibility so benchmark changes can be attributed to a specific feature area.

| Scenario                                 | Start server-side responsibility                                                                                                                                                                                          |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `react/`, `solid/`, `vue/` baseline apps | Document SSR for nested file routes, route matching, search parsing, and full-page HTML response generation.                                                                                                              |
| `assets`                                 | Per-request asset pipeline work: CSS inlining, CDN asset URL transforms with uncached manifest resolution, and response `Link` header collection for early hints.                                                         |
| `before-load`                            | Nested `beforeLoad` execution: sequential per-match context building, context merging across matches, and context consumption by loaders during document SSR.                                                             |
| `control-flow`                           | Loader-thrown `redirect`, `notFound`, plain errors, unmatched routes, and route `headers()` emission, including HTTP status selection, redirect `location` headers, route error boundaries, and not-found HTML rendering. |
| `global-middleware`                      | Global `createStart` middleware registration: request middleware wrapping document SSR, server-function, and server-route requests, plus global function middleware on server functions.                                  |
| `head`                                   | Nested route `head` evaluation, title/meta/link serialization, and head-entry deduplication during SSR.                                                                                                                   |
| `loaders`                                | Nested route loader execution, loader deps from search params, router context reads, and dehydrated loader payload generation.                                                                                            |
| `rewrites`                               | Composed location rewrites from router `basepath` plus locale input/output rewrites; unprefixed URLs redirect to `/app/*` when the basepath output rewrite canonicalizes them.                                            |
| `serialization`                          | Dehydration and RPC serialization of rich non-plain-JSON types: seroval native types in loader payloads, custom serialization adapters, and shallow-error serialization.                                                  |
| `selective-ssr`                          | Route-level `ssr` modes: rendered server HTML with `ssr: true`, dehydrated data without HTML with `ssr: 'data-only'`, and client-only omission with `ssr: false`.                                                         |
| `server-fn-transport`                    | Non-JSON server-function transport: multipart/FormData request decoding, raw `Response` returns, and `RawStream` streamed responses through the binary frame protocol.                                                    |
| `server-fns`                             | `createServerFn` GET/POST request handling, thrown redirect/notFound results, sendContext serialization, SSR-time direct calls, middleware context, input validation, and URL discovery.                                  |
| `server-routes`                          | File route `server.handlers` dispatch for parameterized JSON API routes without document HTML rendering.                                                                                                                  |
| `server-routes-middleware`               | Server route request middleware chains, middleware-provided context merging, and handler access to accumulated context.                                                                                                   |
| `streaming`                              | Deferred loader data, `Await`/Suspense fallback output, larger streamed HTML body scanning, streamed HTML ordering, and later dehydration payload emission.                                                               |

## Run

Run all benchmarks through Nx so dependency builds are part of the graph:

```bash
pnpm nx run @benchmarks/ssr:test:perf --outputStyle=stream --skipRemoteCache
```

Run framework-specific benchmarks:

```bash
pnpm nx run @benchmarks/ssr:test:perf:react --outputStyle=stream --skipRemoteCache
pnpm nx run @benchmarks/ssr:test:perf:solid --outputStyle=stream --skipRemoteCache
pnpm nx run @benchmarks/ssr:test:perf:vue --outputStyle=stream --skipRemoteCache
```

Build framework-specific benchmark apps:

```bash
pnpm nx run @benchmarks/ssr:build:react --outputStyle=stream --skipRemoteCache
pnpm nx run @benchmarks/ssr:build:solid --outputStyle=stream --skipRemoteCache
pnpm nx run @benchmarks/ssr:build:vue --outputStyle=stream --skipRemoteCache
```

Typecheck benchmark sources:

```bash
pnpm nx run @benchmarks/ssr:test:types --outputStyle=stream --skipRemoteCache
```

Run one scenario app manually through Nx:

```bash
pnpm nx run @benchmarks/ssr-<scenario>-<framework>:build:ssr --outputStyle=stream --skipRemoteCache
pnpm nx run @benchmarks/ssr-<scenario>-<framework>:test:types:ssr --outputStyle=stream --skipRemoteCache
```

Use `react`, `solid`, or `vue` for `<framework>`. The baseline projects use `@benchmarks/ssr-<framework>` without a scenario segment.

## Request Conventions

- Document GET loops use `accept: text/html`, matching the baseline request shape.
- Server-function loops must include `sec-fetch-site: same-origin` so the default CSRF middleware accepts the request.
- Loops that expect non-200 responses pass a custom `validateResponse` to `runRequestLoop`.
- Bench loops must build deterministic requests from the seeded random helper and consume response bodies through `runRequestLoop` or `runSsrRequestLoop`.
