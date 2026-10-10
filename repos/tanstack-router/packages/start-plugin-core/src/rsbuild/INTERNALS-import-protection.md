# Rsbuild Import Protection - Adapter Internals

## Scope

This document covers the Rsbuild-specific orchestration around the shared
import-protection core in `src/import-protection/INTERNALS.md`.

Rsbuild owns:

- post-transform enforcement through `api.transform({ order: 'post' })`
- virtual-module transport through `VirtualModulesPlugin`
- compilation-truth reporting in `processAssets`
- final graph reconstruction from Rspack compilation data
- the small build-only deferred queue for file violations that can disappear
  from the compiled graph

Shared AST analysis, rewrite logic, source extraction, usage lookup, source
locations, trace formatting, and mock code generation are described in the
shared internals doc.

## Mental Model

Vite is primarily `resolveId`-driven. Rsbuild is primarily `transform` +
`processAssets`-driven.

That difference explains most of the adapter divergence.

Rsbuild does not emulate the Vite pending-queue state machine. It relies more
directly on post-transform code and final compilation truth.

## Native Hook Shape

Import protection is attached through Rsbuild hooks, not a dedicated mini-plugin
object:

1. `onBeforeBuild`
2. `onBeforeDevCompile`
3. `modifyRspackConfig`
4. `transform(..., { order: 'post' })`
5. `processAssets(..., { stage: 'report' })`

## State Model

Per environment, Rsbuild keeps a smaller runtime state than Vite:

- `resolveCache`
- `seenViolations`
- `buildTransformResults`
- `deferredFileViolations`
- `deferredFileViolationKeys`

Shared state is for virtual module transport and compiler fs access:

- `virtualModules`
- `vmPlugins`
- `readyVmPlugins`
- `inputFileSystems`
- `pendingWrites`

Notably absent compared to Vite:

- no `pendingViolations`
- no `postTransformImports`
- no broad `deferredBuildViolations`
- no resolve-time dev reachability pipeline

## Transform Phase

Rsbuild enforcement runs after the Start compiler in a `post` transform.

That matters because many compiler-safe imports are already stripped by the time
import protection runs. This naturally suppresses a large class of false
positives without a Vite-style pending verification pass.

The transform phase is responsible for:

- self-denial for forbidden files
- self-denial for marker-protected files in the wrong environment
- direct specifier rewrites to mock-edge modules
- build-time transformed/original source preloading for later diagnostics
- recording build-only deferred file violations when original unsafe usage may
  outlive a direct compiled graph edge

## Virtual Module Transport

Rsbuild reuses the shared mock generators, but not the Vite id transport.

Instead it writes environment-scoped virtual files under:

```text
<root>/node_modules/.virtual/import-protection/<env>/
```

The important forms are:

- `mock-silent.mjs`
- `mock-runtime-<base64>.mjs`
- `mock-edge-<base64>.mjs`

Writes may happen before the `VirtualModulesPlugin` instance is ready, so the
adapter queues them and flushes during compilation setup.

## Reporting Phase

`processAssets({ stage: 'report' })` is the authoritative reporting step.

It reconstructs the final view of the compilation from Rspack data by:

1. building a `TransformResultProvider` from `compilation.modules`
2. rebuilding the active compilation graph from outgoing connections
3. reconstructing surviving specifier violations from compiled mock-edge files
4. reporting live file violations from active edges
5. reporting live marker violations from active edges plus original source
6. reporting deferred file violations only when both importer and target truly
   survived compilation

This is the core Rsbuild-native replacement for Vite's `generateBundle`
verification plus dev pending-violation flow.

## Why The Deferred Queue Is Narrow

Rsbuild only needs explicit build deferral for file violations whose direct edge
may disappear after compilation.

Specifier violations are rediscovered from surviving mock-edge virtual files.
Marker violations are rediscovered from live compiled edges.

Only file violations need extra bookkeeping when the final compiled graph can no
longer show the original denied edge directly.

## Source And Compilation APIs

The Rsbuild adapter intentionally prefers native Rspack APIs where possible.

Transform-time:

- `ctx.resource`
- `ctx.context`
- `ctx.resolve(...)`
- captured `compiler.inputFileSystem.readFile(...)`

Compilation-time:

- `module.nameForCondition?.()`
- `module.resourceResolveData?.resource`
- `module.originalSource().sourceAndMap()`
- sourcemap `sourcesContent`
- `compilation.inputFileSystem.readFile(...)`

This keeps the adapter closer to Rsbuild/Rspack truth and avoids falling back to
Node fs when the compilation already has the needed data.

## Marker Handling

Unlike Vite, Rsbuild does not introduce plugin-owned virtual marker modules for
normal operation.

The real package marker files are used as source-level markers, and the adapter
later infers marker kind from original source while reporting compiled edges.

## Practical Maintainer Rule

When changing Rsbuild import protection, ask:

1. Can the change be expressed in shared analysis/rewrite/mock codegen instead?
2. If it is adapter-specific, is it really about post-transform enforcement,
   virtual-file transport, or compilation-time reporting?
3. Can final compilation truth answer the question more simply than adding a new
   pending state machine?
