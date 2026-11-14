# Client Navigation Benchmarks

Cross-framework client-side CPU benchmarks for:

- `@tanstack/react-router`
- `@tanstack/solid-router`
- `@tanstack/vue-router`

The benchmarks run in jsdom against production builds of real apps, and are
tracked in CI by CodSpeed (simulation mode).

> **Scope:** these benchmarks cover the standalone client router only. The
> client side of TanStack Start (hydration of a server-rendered document,
> streamed payload consumption, server-function calls from the client, ...) is
> not covered here; the server side of Start is covered by `benchmarks/ssr`.

## Layout

- `react/`, `solid/`, `vue/` - baseline benchmark (mixed navigation loop) + Vitest config
- `vitest.react.config.ts`, `vitest.solid.config.ts`, `vitest.vue.config.ts` - per-framework aggregate configs that run the baseline first, then scenario projects
- `scenarios/harness.ts` - shared scenario runner (mount, link-click steps, `onRendered` synchronization)
- `scenarios/<scenario>/shared.ts` - framework-agnostic scenario definition (workload data, step sequence, assertions, bench options)
- `scenarios/<scenario>/<framework>/` - isolated scenario apps

Scenario app layout:

```text
scenarios/<scenario>/<framework>/
  vite.config.ts
  speed.bench.ts
  speed.flame.ts
  setup.ts
  project.json
  tsconfig.json
  src/
    main.tsx
    routeTree.gen.ts
    routes/
```

Scenario apps use file-based routing (`@tanstack/router-plugin`) with a
generated `routeTree.gen.ts`, like a regular user app. Each scenario uses one
app per framework instead of sharing routes in the baseline app. This keeps
route-tree size and router options isolated so one scenario cannot shift
another scenario's numbers. The existing baseline apps and bench names stay
stable for CodSpeed continuity.

## Scenario Responsibilities

Each scenario isolates one client-side responsibility so benchmark changes can
be attributed to a specific feature area.

| Scenario                                 | Client-side responsibility                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `react/`, `solid/`, `vue/` baseline apps | Mixed navigation loop: path params, search params, route context, and `useParams`/`useSearch`/`useLoaderData` selector subscriptions.                                                                                                                                                                                                |
| `async-pipeline`                         | The router's async pipeline via counted 0ms timer hops: async loaders (transition-held navigation), async `beforeLoad` context, and parallel nested async loaders. Component-level `Await`/Suspense is excluded: React 19 throttles Suspense reveals by ~300ms wall-clock, which is inherently non-deterministic to benchmark.       |
| `control-flow`                           | Loader-thrown `redirect` (including a 2-hop chain), `notFound()` with `notFoundComponent`, loader errors with `errorComponent`, and boundary reset on recovery navigation.                                                                                                                                                           |
| `head`                                   | `HeadContent` per-navigation work: nested route `head()` evaluation, title/meta/link dedupe across matches, and head tag DOM updates during navigation.                                                                                                                                                                              |
| `history`                                | History push/replace/back/forward traversal, location masking, registered-but-never-blocking `useBlocker`, and `useCanGoBack`/`useLocation` subscriptions.                                                                                                                                                                           |
| `links`                                  | Per-navigation cost of ~200 mounted `<Link>`s: link prop building, active-state recompute across `activeOptions` variants, `activeProps` swaps, and `useMatchRoute` probes (the `MatchRoute` component is avoided: vue-router's implementation leaks one subscription per render).                                                   |
| `loaders`                                | Client loader dispatch: always-stale re-runs (`staleTime: 0`), cached revisits (re-run once per lap by the `invalidate` step), `loaderDeps`-keyed caching, `router.invalidate()`, and `useLoaderData` selectors.                                                                                                                     |
| `mount`                                  | Cold start: `createRouter` (route-tree processing) + first render + initial `router.load()` + unmount, with a fresh router per mount. The only scenario measuring router creation.                                                                                                                                                   |
| `nested-params`                          | Deep nesting (8 dynamic levels): per-level `params.parse`/`stringify`, `beforeLoad` context accumulation across matches, and per-level `useParams`/`useRouteContext` subscriptions. Param values include characters requiring percent-encoding (as do `route-tree-scale`'s), so segment encode/decode paths run on every navigation. |
| `preload`                                | Intent preloading from hover events, programmatic `router.preloadRoute`, deterministic preload cache behavior (`defaultPreloadStaleTime: 0`), and commit-time cache maintenance.                                                                                                                                                     |
| `rewrites`                               | Composed client-side location rewrites: router `basepath` plus a locale input/output rewrite pair, running on every href build and location parse (the client analog of the SSR `rewrites` scenario).                                                                                                                                |
| `route-tree-scale`                       | Route matching and link-target resolution on a wide (~40 route) tree mixing static, dynamic, prefixed-param, splat, pathless-layout, and route-group paths, with `autoCodeSplitting` enabled so navigations also resolve lazy route chunks.                                                                                          |
| `search-params`                          | `validateSearch` execution, search middlewares (`retainSearchParams`/`stripSearchParams`), functional search updaters, structural sharing, and `useSearch` selector subscriptions.                                                                                                                                                   |

## Conventions

- Apps are built with `NODE_ENV=production` (`minify: false`) into `dist/app.js`; benches import the built bundle, so production package builds and production JSX output are measured, not dev transforms.
- Scenarios behave like a real user app: navigation happens through `<Link>` clicks dispatched on real anchor elements (unless a scenario specifically measures the imperative API), the router uses the default browser history, and `scrollRestoration` is enabled.
- Each benchmark iteration advances a fixed, circular sequence of steps; every step awaits the router's `onRendered` event, so render work is included and steps cannot overlap. No two consecutive steps may target the same location, and the sequence ends back on the initial route.
- Setup runs one warm-up lap through the sequence and asserts each step's observable output (e.g. `document.title`), so a scenario that silently stops doing its work fails instead of reporting a fast time.
- Determinism: no wall-clock timers (async work is resolved promises or counted `setTimeout(0)` hops), `staleTime`/`gcTime` only ever `0` or effectively-infinite, no `Math.random`/`Date.now` in the measured loop. Scroll restoration uses `getScrollRestorationKey: (location) => location.pathname` so its cache stays bounded (the default random per-entry key grows one cache entry per push navigation). The `mount` scenario opts out of `scrollRestoration` entirely and destroys its history on unmount — both register page-lifetime globals that would leak across its mount/unmount loop.
- Push-only step laps grow jsdom's session-history entry list over a run (jsdom never truncates entries behind the current index). Per-push cost stays O(1) so timings are unaffected; only the `history` scenario needs — and has — a lap that is depth-stationary.
- Calibration: pick per-iteration step counts so a bench's `vitest bench` run stays roughly between 8 and 30 seconds (long enough to average out, short enough for CI).

## Run

Run all benchmarks through Nx so dependency builds are part of the graph:

```bash
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:perf --outputStyle=stream --skipRemoteCache
```

Run framework-specific benchmarks (baseline + all scenarios):

```bash
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:perf:react --outputStyle=stream --skipRemoteCache
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:perf:solid --outputStyle=stream --skipRemoteCache
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:perf:vue --outputStyle=stream --skipRemoteCache
```

Run a single scenario app manually (after building it through Nx):

```bash
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav-<scenario>-<framework>:build:client --outputStyle=stream --skipRemoteCache
cd benchmarks/client-nav && NODE_ENV=production vitest bench --config ./scenarios/<scenario>/<framework>/vite.config.ts
```

Run framework-specific flame benchmarks (10 second loop, profiled with `@platformatic/flame`, forced to `NODE_ENV=production`):

```bash
# baseline
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:flame:react --outputStyle=stream --skipRemoteCache
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:flame:solid --outputStyle=stream --skipRemoteCache
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:flame:vue --outputStyle=stream --skipRemoteCache
# scenarios
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav-<scenario>-<framework>:test:flame --outputStyle=stream --skipRemoteCache
```

Typecheck benchmark sources (baseline + scenarios):

```bash
CI=1 NX_DAEMON=false pnpm nx run @benchmarks/client-nav:test:types --outputStyle=stream --skipRemoteCache
```
