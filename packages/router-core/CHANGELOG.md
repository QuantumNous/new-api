# @tanstack/router-core

## 1.171.14

### Patch Changes

- [#7695](https://github.com/TanStack/router/pull/7695) [`9809a06`](https://github.com/TanStack/router/commit/9809a0619d4ed3fe8c2a393af5b9eca4b6c7695b) - fix(router-core): re-encode URL-unsafe characters in `sanitizePathSegment` to prevent infinite redirect loops

  `sanitizePathSegment` now re-encodes characters in the WHATWG URL "path percent-encode set" (`<`, `>`, `"`, `` ` ``, `{`, `}`) and ASCII control characters back to their percent-encoded form, instead of stripping control characters. This prevents mismatches between the original URL and the router's internal representation that previously caused infinite 307 redirect loops on paths containing these characters (e.g. `/%7B%7Btemplate%7D%7D`).

  Fixes [#7587](https://github.com/TanStack/router/issues/7587).

## 1.171.13

### Patch Changes

- [#7562](https://github.com/TanStack/router/pull/7562) [`776d8ef`](https://github.com/TanStack/router/commit/776d8ef283e5bd9ffe97d43bc3a7f58064cd7e03) - Prevent scroll restoration listeners from being installed when scroll restoration is disabled.

## 1.171.12

### Patch Changes

- [#7559](https://github.com/TanStack/router/pull/7559) [`df1076c`](https://github.com/TanStack/router/commit/df1076c03ae5a51ab384bebd4d6afda20fb6f107) - Fix retained search params overriding explicit default-valued navigations when used with `stripSearchParams`.

## 1.171.11

### Patch Changes

- [#7555](https://github.com/TanStack/router/pull/7555) [`ac10815`](https://github.com/TanStack/router/commit/ac10815f387d25b15163ff711b4049e8f8482d01) - Fix search middleware composition so `retainSearchParams` does not restore search params that a downstream `stripSearchParams` removed.

## 1.171.10

### Patch Changes

- [#7381](https://github.com/TanStack/router/pull/7381) [`2cca73c`](https://github.com/TanStack/router/commit/2cca73c92262ffd96dac4e283c9f69fb37f4b43a) - fix(router-core): use search validator output type for search middleware context

- [#7549](https://github.com/TanStack/router/pull/7549) [`7a83e67`](https://github.com/TanStack/router/commit/7a83e67e6596fbef21cb0a88a7127f5935bed2ba) - Fix `retainSearchParams` preserving current search params when validation adds default search values during navigation.

- [#7533](https://github.com/TanStack/router/pull/7533) [`76b3d3b`](https://github.com/TanStack/router/commit/76b3d3b24522bd3d1d216674c441252c9b8f184c) - delete $\_TSR immediately on stream end

## 1.171.9

### Patch Changes

- [#7524](https://github.com/TanStack/router/pull/7524) [`b4cd5af`](https://github.com/TanStack/router/commit/b4cd5af8d0f9d4aaa2d29095e6a261b9181bc778) - defer `$_TSR` teardown until DOMContentLoaded

## 1.171.8

### Patch Changes

- [#7505](https://github.com/TanStack/router/pull/7505) [`2f53749`](https://github.com/TanStack/router/commit/2f5374945e2138559a51464f45a5152eae67e1dd) - Preserve primitive values thrown from beforeLoad error handling.

## 1.171.7

### Patch Changes

- [#7497](https://github.com/TanStack/router/pull/7497) [`d1997b6`](https://github.com/TanStack/router/commit/d1997b66d7c24c1d64772bb8bab5caf9c6d9cc48) - fix streaming

## 1.171.6

### Patch Changes

- Add support for Rsbuild client output formats, including module output by default and IIFE output for classic script environments. ([#7477](https://github.com/TanStack/router/pull/7477))

  Client entry scripts and preloads are now represented as root route manifest assets, script preloads follow the manifest script format, and script asset cross-origin configuration uses the `script` key. The `transformAssets` script callback context now exposes only `kind: 'script'` and `url`, keeping script format handling internal to manifest rendering.

## 1.171.5

### Patch Changes

- Fix hash scrolling with `resetScroll={false}` ([#7464](https://github.com/TanStack/router/pull/7464))

## 1.171.4

### Patch Changes

- Fix hash navigation being overridden by stale scroll restoration entries. ([#7447](https://github.com/TanStack/router/pull/7447))

- Preserve carried scroll positions across SPA navigations that create new restoration keys. ([#7447](https://github.com/TanStack/router/pull/7447))

## 1.171.3

### Patch Changes

- Add deferred Hydrate boundary support for TanStack Start. ([#7362](https://github.com/TanStack/router/pull/7362))

  Hydrate boundaries can now be code-split by the Start compiler, preload their generated client chunks, preserve server-rendered fallback HTML, and replay interaction-triggered events after hydration. The compiler integration now uses a Start-owned compiler plugin for Hydrate virtual modules across Vite and Rsbuild, with dev invalidation for generated virtual modules.

  Shared AST utilities used by the router code-splitter and Hydrate virtual modules were moved into `@tanstack/router-utils` so both pipelines can retain referenced top-level declarations, unwrap local exports, and let dead-code elimination remove unused route module code.

## 1.171.2

### Patch Changes

- Fix route mismatch warnings, HMR route index refresh, and generated route type preferences for duplicate pathless/index routes. ([#7422](https://github.com/TanStack/router/pull/7422))

## 1.171.1

### Patch Changes

- Run custom router hydration before the initial client route match so hydrated router configuration, such as request-specific URL rewrites, can be installed before SSR hydration compares matches. ([#7416](https://github.com/TanStack/router/pull/7416))

## 1.171.0

### Minor Changes

- params.priority route option as tie breaker in route matching algorithm ([#7411](https://github.com/TanStack/router/pull/7411))

## 1.170.1

### Patch Changes

- Add runtime-configurable inline CSS and opt-in CSS URL templates for transformAssets. ([#7380](https://github.com/TanStack/router/pull/7380))

## 1.170.0

### Minor Changes

- Clean minor bump, fresh start ([#7395](https://github.com/TanStack/router/pull/7395))

### Patch Changes

- fix(router-core): fix missing closing paren in CSS.supports check for view transition types ([#7369](https://github.com/TanStack/router/pull/7369))

- Updated dependencies [[`201e150`](https://github.com/TanStack/router/commit/201e150bd1412bae2faa9ce53f0fefcb7574ac14)]:
  - @tanstack/history@1.162.0

## 1.169.2

### Patch Changes

- Update seroval dependencies to version 1.5.4. ([#7340](https://github.com/TanStack/router/pull/7340))

## 1.169.1

### Patch Changes

- Fix params.parse inference for discriminated union path params while preserving path key validation. ([#7306](https://github.com/TanStack/router/pull/7306))

## 1.169.0

### Minor Changes

- Allow `params.parse` to experimentally return `false` to skip an incoming route candidate during path matching. Thrown parse errors still surface on the selected match instead of falling through, and outgoing typed route-template links continue to use exact route lookup followed by `params.stringify` for URL generation. ([#7263](https://github.com/TanStack/router/pull/7263))

## 1.168.18

### Patch Changes

- prevent isServer exports from being transformed to top-level vars so rspack can dead-code eliminate them ([#7293](https://github.com/TanStack/router/pull/7293))

## 1.168.17

### Patch Changes

- wildcard nodes have the same priority rules as other nodes in route matching ([#7273](https://github.com/TanStack/router/pull/7273))

## 1.168.16

### Patch Changes

- Add TanStack Start inline CSS manifest support for SSR so route styles can be embedded in the HTML response and hydrated without duplicate stylesheet links. ([#7253](https://github.com/TanStack/router/pull/7253))

## 1.168.15

### Patch Changes

- Fix async loaders that throw or return `notFound()` so they do not briefly mark the match as `success` before the final not-found boundary is resolved. ([#7184](https://github.com/TanStack/router/pull/7184))

  This prevents route components from rendering with missing loader data during navigation when React observes the intermediate match state before not-found finalization completes.

## 1.168.14

### Patch Changes

- chore: bump to h3 v2-rc.20 ([#7140](https://github.com/TanStack/router/pull/7140))

## 1.168.13

### Patch Changes

- Reduce React Start SSR manifest payload size by omitting unmatched route assets from dehydrated router state while keeping start-manifest asset serialization deduplicated by shared object identity. ([#7157](https://github.com/TanStack/router/pull/7157))

  This improves SSR HTML size for apps with many routes that share the same CSS assets and adds regression coverage for CSS module hydration, navigation, and start-manifest asset reuse.

## 1.168.12

### Patch Changes

- avoid false notFound matches for proxied loader data ([#7156](https://github.com/TanStack/router/pull/7156))

## 1.168.11

### Patch Changes

- shorten internal non-minifiable store names for byte shaving ([#7152](https://github.com/TanStack/router/pull/7152))

## 1.168.10

### Patch Changes

- migrate createStore > createAtom for simpler API ([#7150](https://github.com/TanStack/router/pull/7150))

## 1.168.9

### Patch Changes

- Preserve component-thrown `notFound()` errors through framework error boundaries so route `notFoundComponent` handlers render without requiring an explicit `routeId`. ([#7077](https://github.com/TanStack/router/pull/7077))

## 1.168.8

### Patch Changes

- Fix preload from continuing into child `beforeLoad` and `head` handlers after a parent `beforeLoad` fails. ([#7075](https://github.com/TanStack/router/pull/7075))

## 1.168.7

### Patch Changes

- Avoid re-running hash scrolling after SSR hydration when later preload or invalidate cycles resolve without a location change. ([#7066](https://github.com/TanStack/router/pull/7066))

## 1.168.6

### Patch Changes

- Fix a regression where browser back/forward navigation could fail to restore the previous scroll position for an existing history entry. ([#7055](https://github.com/TanStack/router/pull/7055))

## 1.168.5

### Patch Changes

- fix: scroll restoration without throttling ([#7042](https://github.com/TanStack/router/pull/7042))

## 1.168.4

### Patch Changes

- tanstack/store 0.9.3 ([#7041](https://github.com/TanStack/router/pull/7041))

## 1.168.3

### Patch Changes

- feat: transformAssets ([#7023](https://github.com/TanStack/router/pull/7023))

## 1.168.2

### Patch Changes

- Replace tiny-invariant and tiny-warning with in-house solution for bundle-size ([#7007](https://github.com/TanStack/router/pull/7007))

## 1.168.1

### Patch Changes

- Update store to 0.9.2 ([#6993](https://github.com/TanStack/router/pull/6993))

## 1.168.0

### Minor Changes

- remove pendingMatches, cachedMatches ([#6704](https://github.com/TanStack/router/pull/6704))
  move to signal-based reactivity
  solid uses its own native signals

## 1.167.5

### Patch Changes

- chore: bump esbuild to 0.27.4 ([#6975](https://github.com/TanStack/router/pull/6975))

## 1.167.4

### Patch Changes

- Add @tanstack/intent AI agent skills and CLI entry points for Router and Start packages ([#6866](https://github.com/TanStack/router/pull/6866))

## 1.167.3

### Patch Changes

- Fix retained chained router promise refs during route loads and commits. ([#6929](https://github.com/TanStack/router/pull/6929))

## 1.167.2

### Patch Changes

- build: update to vite-config 5.x (rolldown) ([#6926](https://github.com/TanStack/router/pull/6926))

- Updated dependencies [[`838b0eb`](https://github.com/TanStack/router/commit/838b0eb9a8bbbb987a0a6972c1446e01423bbd7b)]:
  - @tanstack/history@1.161.6

## 1.167.1

### Patch Changes

- fix: build with @tanstack/vite-config 0.4.3 ([#6923](https://github.com/TanStack/router/pull/6923))

- Updated dependencies [[`ef9b241`](https://github.com/TanStack/router/commit/ef9b241f3cfe95cee40daa96da669f0ffd4a971a)]:
  - @tanstack/history@1.161.5

## 1.167.0

### Minor Changes

- feat: add staleReloadMode ([#6921](https://github.com/TanStack/router/pull/6921))
