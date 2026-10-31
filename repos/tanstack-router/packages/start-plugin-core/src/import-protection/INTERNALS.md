# Import Protection - Shared Internals

## Overview

`src/import-protection/` contains the adapter-independent core for TanStack
Start import protection.

Its current structure is:

- parse module code once per `TransformResult`
- derive a read-only `ImportAnalysis` object from that AST
- reuse that analysis for source extraction, import-specifier locations, mock
  export discovery, named export discovery, and usage lookup
- keep AST mutation in a separate rewrite pass
- keep adapter lifecycle/state-machine behavior outside this directory

The shared layer is responsible for correctness-sensitive logic that must stay
aligned between Vite and Rsbuild.

## Shared Module Layout

### `analysis.ts`

The central shared analysis module.

It builds and caches `ImportAnalysis` on `TransformResult.analysis`.

`ImportAnalysis` contains:

- parsed AST
- line index
- import sources in source order
- import specifier literal locations
- imported bindings by source
- mock export names by source
- named exports
- usage-position cache

It exposes both result-based and code-based helpers:

- `getOrCreateImportAnalysis(result)`
- `getImportSourcesFromResult(result)`
- `getImportSources(code)`
- `getImportSpecifierLocationFromResult(result, source)`
- `getMockExportNamesBySourceFromResult(result)`
- `getMockExportNamesBySource(code)`
- `getNamedExportsFromResult(result)`
- `getNamedExports(code)`
- `findPostCompileUsagePosFromResult(result, source)`
- `findPostCompileUsagePos(code, source)`
- `findOriginalUnsafeUsagePosFromResult(result, source, envType)`
- `findOriginalUnsafeUsagePos(code, source, envType)`
- `isValidExportName(name)`

### `adapterUtils.ts`

Contains small adapter-facing shared helpers for decisions that are identical in
Vite and Rsbuild.

It currently owns:

- environment type selection from `envTypeMap`
- environment rule selection from `compiledRules`
- normalized root-relative path calculation
- importer filtering via include/exclude/ignore/srcDirectory rules

This keeps the adapters from duplicating the same targeting logic while still
leaving lifecycle-specific behavior in the adapter implementations.

### `rewrite.ts`

Contains the actual AST mutation pass for denied static imports and re-exports.

It is intentionally separate from `analysis.ts`.

Why:

- analysis is read-only and cacheable
- rewrite mutates AST structure and generates code/maps
- keeping them separate prevents adapter code from depending on mutation when it
  only needs inspection

`rewriteDeniedImports()` rewrites denied static import/re-export edges to mock
module imports while preserving explicit bindings expected by the importer.

### `sourceLocation.ts`

Builds source locations and snippets from transformed code plus sourcemaps.

It reuses shared analysis for two important lookups:

- import-specifier positions in transformed code
- post-compile and original-source usage locations

It also owns:

- line-index helpers
- sourcemap normalization
- `sourcesContent` original-source selection
- import-location caching for traces
- code snippet formatting

### `virtualModules.ts`

Owns the shared mock module generators and payload encoding.

This includes:

- silent mock module code
- runtime diagnostic mock module code
- mock-edge module code with explicit named exports
- self-denial module generation for denied files
- marker module loading

The adapter-specific transport of these modules is not handled here.

### `defaults.ts`, `matchers.ts`, `utils.ts`, `trace.ts`

These remain shared support layers:

- `defaults.ts`: default deny/marker rules
- `matchers.ts`: compiled glob/regex matcher utilities
- `utils.ts`: path normalization, candidate generation, messages, defer logic,
  generic helpers
- `trace.ts`: import graph, traces, snippet-aware message formatting

## Analysis Lifetime And Cache Model

The key cache decision is: analysis is cached per `TransformResult`, not
globally by source text.

That means:

- Vite can attach analysis to transform-cache results for the current module
  version
- Rsbuild can attach analysis to transform results rebuilt from compilation or
  preloaded during transform
- cache invalidation follows the host tool's normal module invalidation model
- long dev/HMR sessions do not accumulate an unbounded process-global AST cache

The analysis object is read-only after creation, except for the internal
`usageByKey` memoization map.

## Import Source Extraction

`getImportSources()` is now AST-driven and returns sources in encountered order.

It includes:

- `import ... from 'x'`
- `export ... from 'x'`
- `export * from 'x'`
- `import('x')`
- dynamic import call forms supported by Babel's AST shape

Adapter code that needs source extraction should call into `analysis.ts`
directly.

## Mock Export Discovery

Mock-edge modules need to know which named exports the importer expects.

`analysis.ts` derives that from the importer AST by recording:

- named import specifiers
- namespace member access
- default-import member access
- re-export specifiers

This produces `mockExportNamesBySource`, which is a safe over-approximation of
the named exports the adapter should expose on a mock-edge module.

## Named Export Discovery

Self-denial needs the denied file's export surface.

`getNamedExports()` and `getNamedExportsFromResult()` collect valid named
exports from:

- function/class declarations
- variable declarations, including destructuring patterns
- export specifiers and aliases

`default` is excluded from the named export list because the mock generators
handle default export separately.

## Usage Lookup And Safe Boundaries

Usage lookup is shared across adapters through `analysis.ts`.

The walker:

- tracks lexical/program/block/function bindings manually
- respects shadowing across nested scopes, block bindings, function params, and
  `catch` params
- treats certain compiler-recognized boundaries as safe when looking for
  original unsafe usage

Safe boundary recognition is environment-specific:

- client env safe boundaries:
  - `createServerFn().handler(...)`
  - `createMiddleware(...).server(...)`
  - `createIsomorphicFn().server(...)`
  - `createServerOnlyFn(...)`
- server env safe boundaries:
  - `createClientOnlyFn(...)`
  - `createIsomorphicFn().client(...)`

This is the core shared logic that keeps both adapters aligned on cases like
`boundary-safe`, `factory-safe`, and `compiler-leak`.

## Rewriting Versus Analysis

Analysis and rewrite are intentionally separate.

Reasons:

- adapters frequently need inspection without mutation
- mutation wants a fresh, isolated AST/codegen pass
- read-only analysis is much easier to cache safely
- source-location helpers and usage lookup should not depend on whether a module
  was rewritten

The intended flow is:

1. build or reuse `ImportAnalysis`
2. inspect/import-locate/trace as needed
3. if a denied-specifier rewrite is needed, run `rewriteDeniedImports()`

## Adapter Contract

The shared layer deliberately does not decide:

- when a violation is discovered
- when it is reported versus deferred
- how dev/build lifecycle hooks work
- how virtual module ids/files are transported by the bundler
- how final compilation truth is obtained

Those are adapter responsibilities.

The shared layer does provide the primitives both adapters rely on:

- rule helpers
- AST parsing
- analysis
- rewrite
- virtual module code generation
- source locations/snippets
- trace formatting

## Maintainer Guidance

When making future import-protection changes:

1. If the behavior is about parsing, source extraction, export discovery, usage
   lookup, source locations, rewrite mechanics, or mock codegen, it probably
   belongs in `src/import-protection/`.
2. If the behavior is about hook timing, deferral, compilation truth, pending
   queues, or environment-specific virtual-module transport, it probably belongs
   in the adapter docs/code.
3. Prefer extending `ImportAnalysis` over adding new one-off parsers or wrapper
   helpers.
4. Avoid reintroducing global source-text caches; cache on `TransformResult`
   instead.
