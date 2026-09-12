# @tanstack/router-utils

## 1.162.2

### Patch Changes

- [#7552](https://github.com/TanStack/router/pull/7552) [`301f6ba`](https://github.com/TanStack/router/commit/301f6ba4599386edd6fb3b8423938c48eedb501f) - Fix Start compiler handling for TS-wrapped server/env-only function calls and safely remove unused imported server function handlers from client output.

## 1.162.1

### Patch Changes

- Add deferred Hydrate boundary support for TanStack Start. ([#7362](https://github.com/TanStack/router/pull/7362))

  Hydrate boundaries can now be code-split by the Start compiler, preload their generated client chunks, preserve server-rendered fallback HTML, and replay interaction-triggered events after hydration. The compiler integration now uses a Start-owned compiler plugin for Hydrate virtual modules across Vite and Rsbuild, with dev invalidation for generated virtual modules.

  Shared AST utilities used by the router code-splitter and Hydrate virtual modules were moved into `@tanstack/router-utils` so both pipelines can retain referenced top-level declarations, unwrap local exports, and let dead-code elimination remove unused route module code.

## 1.162.0

### Minor Changes

- Clean minor bump, fresh start ([#7395](https://github.com/TanStack/router/pull/7395))

## 1.161.8

### Patch Changes

- Parse plain TypeScript files without JSX when a filename is available, preventing angle-bracket type assertions from being interpreted as JSX during route and Start import-protection transforms. ([#7342](https://github.com/TanStack/router/pull/7342))

## 1.161.7

### Patch Changes

- rsbuild ([#7228](https://github.com/TanStack/router/pull/7228))

## 1.161.6

### Patch Changes

- build: update to vite-config 5.x (rolldown) ([#6926](https://github.com/TanStack/router/pull/6926))

## 1.161.5

### Patch Changes

- fix: build with @tanstack/vite-config 0.4.3 ([#6923](https://github.com/TanStack/router/pull/6923))
