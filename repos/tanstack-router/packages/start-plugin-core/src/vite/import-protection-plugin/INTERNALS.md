# Vite Import Protection - Adapter Internals

## Scope

This document covers the Vite-specific orchestration around the shared
import-protection core in `src/import-protection/INTERNALS.md`.

Vite owns:

- `resolveId`-first violation discovery.
- Dev and build deferral decisions tied to Vite lifecycle hooks.
- Per-environment state that bridges resolve-time data with transform-time data.
- The transform-cache plugin and post-transform graph bookkeeping.
- Selective diagnostic sourcemap capture while transformed code is in plugin scope.
- Vite virtual-module id resolution and loading.
- Bundle-time survival checks in `generateBundle`.
- Opt-in perf counters and timings for this adapter.

Shared AST analysis, rewrite logic, source extraction, mock export discovery,
usage lookup, source locations, and mock code generation live under
`src/import-protection`.

## Plugin Shape

`importProtectionPlugin()` returns two Vite plugins:

1. `tanstack-start-core:import-protection`
2. `tanstack-start-core:import-protection-transform-cache`

The first plugin owns resolve-time detection, virtual-module resolution,
reporting decisions, build survival checks, dev-server capture, HMR invalidation,
and perf flushing.

The second plugin owns transformed-result caching, selective diagnostic sourcemap
capture, self-denial transforms, post-transform import graph updates, dev
pending-violation verification, and dev import rewrites.

Both plugins use `applyToEnvironment()` and only run for Start environments:

- `client`
- `ssr`
- the optional provider environment when it differs from `ssr`

The adapter resolves client/server semantics from `config.envTypeMap`; Vite's
server environment is named `ssr`, but import protection reports it as the
`server` boundary.

## Hook Filters

The Vite adapter uses hook filters to reduce avoidable JS hook calls:

- `resolveId.filter.id.exclude` skips most `\0` and `virtual:` ids, while still
  allowing import-protection virtual ids through.
- `load.filter.id` only handles resolved import-protection virtual-module ids.
- `transform.filter.id.include` limits transform-cache work to JS/TS module ids
  matching `/\.[cm]?[tj]sx?($|\?)/`.

The runtime checks still keep defensive early returns for internal virtual ids
and out-of-scope importers.

## Why Vite Uses Two Plugins

Vite discovers many violations in `resolveId`, but accurate source locations and
post-transform graph truth require code that only exists later.

The adapter splits responsibilities:

- `resolveId` detects, classifies, defers or reports, records graph edges, and
  substitutes mock ids where needed.
- The later transform hook caches plugin-input code, selectively captures
  diagnostic sourcemaps, self-denies files, computes post-transform imports, and
  processes pending violations.

The transform-cache plugin runs after `enforce: 'pre'` hooks, including the Start
compiler. This means it sees the code as it enters this plugin after upstream
transforms, not the file read from disk.

## State Model

Per environment, Vite keeps `EnvState` with:

- `graph`: an `ImportGraph` of source and post-transform edges.
- `mockExportsByImporter`: parsed export names for denied specifier mock modules.
- `resolveCache`: successful `this.resolve()` results keyed by importer/source.
- `resolveCacheByFile`: reverse index for invalidating resolve-cache keys.
- `importLocCache`: cached import-statement locations.
- `seenViolations`: dedupe state and retroactive-marker guard keys.
- `serverFnLookupModules`: modules known to be pre-transform lookup variants.
- `transformResultCache`: transformed code plus optional diagnostic sourcemap.
- `transformResultKeysByFile`: all cached ids for a physical file, including split variants.
- `transformResultProvider`: lookup facade used by diagnostic helpers.
- `postTransformImports`: resolved imports found after the Start compiler ran.
- `pendingViolations`: dev mock violations awaiting edge/reachability verification.
- `deferredBuildViolations`: build violations awaiting tree-shaking survival checks.

Cross-environment shared state is intentionally small:

- `fileMarkerKind`: normalized file path to `server` or `client` marker kind.

This state model is larger than the Rsbuild adapter because Vite must bridge
resolve-time detection with later transform and bundle verification.

## Lifecycle Hooks

`configResolved` initializes adapter config from Vite and Start config:

- root, command, bundled dev mode, and source directory.
- behavior, log mode, mock access mode, max trace depth, and `onViolation`.
- default and user import-protection rules compiled into matchers.
- marker specifiers for server-only and client-only modules.
- include, exclude, and ignored-importer matchers.

`configureServer` stores the dev server so traces can fall back to Vite's
per-environment module graph on warm starts.

`buildStart` clears bounded and unbounded caches, clears shared marker state,
and registers known Start entries for every configured environment.

`hotUpdate` invalidates every file-scoped cache for changed modules:

- extensionless absolute-id resolution.
- shared marker state for the file.
- import-location cache entries.
- resolve cache entries indexed by that file.
- import graph edges where the file is importer or resolved target.
- mock export cache for the file.
- server-fn lookup state for the file.
- pending violations for the file.
- transform-result cache entries and post-transform imports for all variants.

`closeBundle` flushes cumulative opt-in perf output when perf collection is
enabled.

## Detection Flow

The Vite adapter is `resolveId`-driven.

That means it may see violations before:

- the Start compiler removes safe-boundary imports.
- tree-shaking removes false-positive edges.
- transformed importer code is available.

For `resolveId` calls with no importer, the adapter records entry roots and then
flushes pending violations because reachability may now have new roots. In
bundled client dev, source entries inside `srcDirectory` are not added as entry
roots because that would make every source module appear reachable.

For imported modules, `resolveId` does this in order:

- Resolve import-protection virtual ids via `resolveInternalVirtualModuleId()`.
- Ignore unrelated `\0` and `virtual:` sources.
- Normalize the importer and classify direct `SERVER_FN_LOOKUP` resolves.
- In bundled client dev, add route modules under `src/routes` as source roots.
- Treat direct lookup modules, transitive lookup modules, and Vite scan resolves
  as pre-transform resolves.
- Avoid recording source graph edges for server-fn lookup modules because those
  variants contain uncompiled code.
- Detect marker imports before importer-scope checks so marker files can set
  shared `fileMarkerKind`.
- Skip importers outside import-protection scope after marker handling.
- Check denied specifiers before resolving the import.
- Resolve imports through `this.resolve()` when needed, cache successful results,
  and canonicalize resolved ids.
- Add graph edges for authoritative resolves when the importer is not a
  server-fn lookup module.
- Check resolved file-denial rules and resolved marker-file conflicts.
- Dispatch violations through `reportOrDeferViolation()`.

`this.resolve()` calls are counted and timed when perf collection is enabled.
Only successful resolves are cached; `null` results are not cached because they
can be order-dependent across importer variants such as split route ids.

## Marker Handling

Marker imports are imports of framework marker modules such as
`@tanstack/react-start/server-only` and `@tanstack/react-start/client-only`.

When `resolveId` sees a marker import, it:

- Records the normalized importer file in `shared.fileMarkerKind`.
- Throws immediately if a file has both server-only and client-only markers.
- Builds a marker violation if the current environment is the opposite boundary.
- Returns a marker virtual module for normal marker imports.
- In build mode, returns a unique build mock id for a deferred marker violation
  so `generateBundle` can check whether the importer survived.

Marker conflicts can also be discovered after resolving a normal import. If the
resolved target file was previously marked for the opposite environment,
`buildMarkerViolationFromResolvedImport()` creates the marker violation.

Cold-start ordering can resolve module A importing module B before module B's
marker import has run. When B's marker is later recorded, the adapter
retroactively checks known importers in the graph, creates deferred marker
violations for matching importers, and immediately runs pending-violation
processing.

## Deferral Policy

The shared helper reduces to:

```ts
shouldDefer = isBuild || isDevMock
```

Adapter meaning:

- Dev plus error reports immediately for non-pre-transform resolves.
- Dev plus error silences pre-transform resolves because imports inside compiler
  safe boundaries may not have been stripped yet, and there is no deferred
  verification path in this mode.
- Dev plus mock stores `pendingViolations`, then verifies later with
  post-transform edge survival and reachability.
- Build plus mock and build plus error store `deferredBuildViolations`, then
  verify in `generateBundle` after tree-shaking.

This is the main Vite-specific state machine difference from Rsbuild.

## Lightweight Violations

`buildViolationInfo()` creates a lightweight `ViolationInfo` record.

The lightweight record contains:

- environment name and boundary type.
- effective behavior.
- importer and specifier.
- violation type, pattern, and resolved path when known.
- an optional trace override.

It intentionally does not compute expensive diagnostic data.

Deferred work includes:

- trace reconstruction.
- source-location lookup.
- code snippets.
- source-map mapping.
- AST usage analysis for the reported location.

This work runs in `enrichViolationInfo()` only when a violation is about to be
emitted or passed to `onViolation`. Violations suppressed by edge survival,
reachability, or tree-shaking are never enriched.

## Diagnostic Candidates

A diagnostic candidate is a transformed module that is likely to need original
source diagnostics later.

This is not a confirmed violation. It is only a cheap transform-time decision
about whether to capture the composed sourcemap while Vite/Rolldown still makes
`this.getCombinedSourcemap()` safely available.

`shouldCaptureDiagnosticSourceMap()` returns `true` when the transformed code
contains import/export syntax and appears to reference import-protection inputs:

- The code contains the opposite-boundary filename token, `.server` for client
  environments or `.client` for server environments.
- The code contains any configured marker specifier.
- The code contains a literal denied specifier pattern.
- A custom non-literal specifier matcher is configured.
- A file matcher is a `RegExp` or does not contain the simple boundary token.

The predicate intentionally does not parse import source literals with regexes.
For default rules, the fast path is substring checks for `import`/`export`,
`.server`, `.client`, marker specifiers, and default framework specifier strings.
For custom non-literal rules, it captures more broadly for modules with
import/export syntax rather than attempting a second import parser.

`captureDiagnosticSourceMap()` is best effort:

- It does nothing if the transform result already has a map.
- It calls `this.getCombinedSourcemap()` only for diagnostic candidates or a
  confirmed dev mock file violation found during the transform import-resolution loop.
- It stores the map on the cached `TransformResult` when capture succeeds.
- It ignores capture failures; diagnostics then fall back to transformed-code
  locations and snippets when possible.
- It records perf counters by reason, currently `candidate` and `devViolation`.

The adapter does not read original files from disk for diagnostics. Original
source text comes only from the code and sourcemaps that reach this plugin.

## Original Code And Snippets

The transform cache stores transformed code for every in-scope transformed module
that is not self-denied. It stores a composed sourcemap only when selective
diagnostic capture succeeds.

`sourceLocation` derives original code lazily:

- `getOriginalCode()` reads `map.sourcesContent` only on demand.
- `pickOriginalCodeFromSourcesContent()` picks the best source by exact file,
  resolved source path, suffix segment score, and finally the first source.
- `getOrCreateOriginalTransformResult()` creates an original-source transform
  result only when original code exists.
- The derived original result is cached on the transform result.

Importer locations prefer the most useful usage site rather than the import
statement. The lookup order is:

1. First post-compile usage of the denied binding, mapped through the sourcemap.
2. Original-source unsafe usage from `sourcesContent`, excluding compiler-safe boundary callbacks.
3. Transformed import-statement location, mapped through the sourcemap.

Before lookup, enrichment builds multiple source candidates from the original
specifier, resolved paths, root-relative paths, extensionless paths, and
importer-relative paths.

When a location is found, diagnostics include a vitest-style `Code:` snippet
around that line. Snippets prefer original source from `sourcesContent` when it
is available. If original source is unavailable, snippets use transformed code.
If no location is found, the violation still reports without a snippet.

## Trace Construction

Trace construction is lazy and runs during enrichment.

The adapter normally rebuilds traces from its own `ImportGraph`. In dev serve,
it may prefer Vite's per-environment `moduleGraph` when that graph produces a
longer trace. This helps warm-start cases where Vite skipped some `resolveId`
calls.

Trace steps are annotated with import-statement locations from transformed-code
data when available. The leaf step falls back to the resolved importer location
if the trace did not already have a location.

## Runtime Mock Diagnostics

Dev client mocks can embed a runtime diagnostic payload in the virtual module
id. The payload includes:

- environment name.
- importer.
- specifier.
- runtime mock access mode.
- the trace currently present on `ViolationInfo`.

Because dev mock violations are substituted during silent deferral, the runtime
mock id is often created before lazy enrichment. Browser runtime diagnostics are
therefore access diagnostics, not the canonical source trace. The authoritative
trace and snippet are produced later when a pending violation is confirmed and
emitted to terminal output.

Self-denial runtime mocks currently carry an empty trace payload because they are
created directly from the denied file's own transform.

## Dev Strategy

### Dev Plus Error

Vite throws immediately for non-pre-transform violations in `resolveId`.

This mode can still produce known false positives because there is no dev-server
tree-shaking phase. Pre-transform resolve paths like `SERVER_FN_LOOKUP` are
silenced because they fire before compiler stripping and have no later deferred
verification path in error mode.

### Dev Plus Mock

Vite defers all violations into `pendingViolations`.

Later, the transform-cache plugin:

1. Self-denies files when the transformed file itself violates file rules.
2. Caches transformed code and any selectively captured diagnostic sourcemap.
3. Resolves import sources from the transformed code.
4. Records `postTransformImports` for the normalized Vite id and physical file path.
5. Adds import graph edges from transformed-code imports for warm-start traces.
6. Maps import-protection mock-edge ids back to physical paths for edge survival.
7. Detects file violations missed by warm-start `resolveId` cache hits.
8. Rewrites denied imports to mock replacements in dev mock mode.
9. Runs `processPendingViolations()` after each transform-cache update.

Pending verification uses edge survival and reachability.

`filterEdgeSurvival()` returns:

- `all-stripped` when post-transform imports prove every pending violation was removed.
- `await-transform` when pre-transform violations need transform data first.
- active violations plus whether edge-survival data was applied.

`checkPostTransformReachability()` returns:

- `reachable` when a live path reaches a registered entry.
- `unreachable` when all known live paths are cut off.
- `unknown` when some graph edges still lack transform data.

In dev serve with `unknown` reachability, the adapter can conservatively emit
confirmed-surviving violations or in-scope file violations when pre-transform
data is not involved.

Bundled client dev has a special case. After edge survival has proved an import
survived, the adapter uses source-graph reachability because child transforms can
run before their route/importer source edges are known. If bundled client dev
finds a surviving violation currently unreachable, it keeps the violation pending
instead of dropping it.

## Build Strategy

Vite build uses mock-first, verify-later behavior.

At resolve time, `reportOrDeferViolation()` calls `handleViolation()` silently to
obtain the replacement id and stores a `DeferredBuildViolation`.

Build replacements differ by violation type:

- File violations return the physical resolved path; self-denial later replaces
  that file's content.
- Specifier violations return a mock-edge virtual module whose payload references
  a unique build mock runtime id.
- Marker violations return a mock-edge virtual module whose payload references a
  unique build mock runtime id when the direct marker import violates the current
  environment.

At `generateBundle`, the adapter builds a set of module ids that survived
tree-shaking. It normalizes multiple forms for comparison:

- raw bundle module id.
- normalized id with query/hash stripped.
- root-relative path.
- internal `\0` virtual id.
- browser `__x00__` virtual id.

Survival checks differ by violation type:

- File violations check whether the physical resolved path survived after
  self-denial replaced that module's content.
- Specifier violations check whether the mock-edge module id survived.
- Marker violations check whether the importer survived, including all
  transform-result variant ids for that importer.

Only surviving violations are enriched. After `onViolation` allows them:

- Build plus error fails on the first real surviving violation.
- Build plus mock warns once per dedupe key.
- Non-surviving violations are suppressed as tree-shaken false positives.

## Self-Denial In Vite

For file-based violations, `resolveId` does not return a virtual mock id.
Instead it returns the physical file path, and the transform-cache plugin
independently decides whether that file is denied in the current environment.

This Vite-specific choice exists for two reasons:

- It avoids cross-environment cache contamination in shared resolver caches.
- It avoids cold-start export-resolution issues when importer AST data is not
  yet available.

Self-denial runs before normal transform-result caching.

Build self-denial returns a self-contained mock module generated from exports
parsed from the denied file's code.

Dev self-denial returns a mock module generated from the denied file's exports.
For client-env self-denial with runtime mock access enabled, that mock references
a runtime diagnostic module. For server-env self-denial, or when mock access is
off, `mockRuntimeModuleIdFromViolation()` resolves to the silent mock module.
The runtime diagnostic id is built from the denied file itself and currently has
an empty trace payload.

Because self-denial exits the transform hook early, self-denied files do not go
through the normal transform-result cache path for that environment.

## Mock Export Resolution

Specifier and marker mocks need explicit named exports so ESM imports continue
to link.

`resolveExportsForDeniedSpecifier()` runs only while handling a violation. It
tries, in order:

- cached export maps for the importer.
- transformed importer code from `transformResultProvider`.
- `ctx.getModuleInfo(importerIdHint)?.code` as a fallback.
- AST parsing through `getMockExportNamesBySource()`.
- resolver-based aliases that index source keys by resolved physical ids.

The result is cached in `mockExportsByImporter` and used by `makeMockEdgeModuleId()`.

## Virtual Modules

The shared mock generators use abstract ids without Vite's resolved `\0` prefix,
such as:

- `tanstack-start-import-protection:mock`
- `tanstack-start-import-protection:mock:build:`
- `tanstack-start-import-protection:mock-edge:`
- `tanstack-start-import-protection:mock-runtime:`
- `tanstack-start-import-protection:marker:`

The Vite adapter adds:

- a resolved `\0` prefix via `resolveViteId(...)`.
- browser-prefixed ids via `__x00__` for virtual ids that pass through browser import paths.
- `resolveInternalVirtualModuleId()` for normalizing import-protection virtual ids in `resolveId`.
- `loadResolvedVirtualModule()` for serving generated virtual module code in `load`.

The generated module contents are shared. The id transport is Vite-specific.

## Warm-Start Considerations

Vite can skip `resolveId` on warm cache hits.

The adapter compensates by:

- caching transformed code under both normalized Vite id and physical file path.
- tracking all transform-result keys per physical file.
- resolving transformed import sources in the transform-cache plugin.
- recording post-transform imports for edge-survival checks.
- adding graph edges from transformed imports for trace accuracy.
- detecting dev mock file violations that `resolveId` missed on warm starts.
- falling back to Vite's module graph for longer dev traces.

Pre-transform lookup variants are explicitly excluded from post-transform
liveness data because they contain uncompiled code.

## Perf Instrumentation

Perf collection is opt-in:

```sh
TSR_IMPORT_PROTECTION_PERF=1
TSR_IMPORT_PROTECTION_PERF=true
```

When enabled, the adapter records counters and timings for:

- `resolveId` calls.
- transform-cache calls.
- `this.resolve()` calls from resolve and transform paths.
- transform import analysis.
- shared AST parsing performed by import analysis and diagnostic lookup.
- number of import sources found in transform-cache.
- violations detected.
- violations enriched.
- diagnostic sourcemap capture by reason.
- diagnostic sourcemap capture timing.

Output is written as cumulative JSON to `TSR_IMPORT_PROTECTION_PERF_FILE` when
set. Without that file, output is logged on each `closeBundle()`. The payload
includes `flushCount` and `flushEnvironments` so multi-environment builds can be
checked for full coverage.

When perf is disabled, the adapter only keeps a single `perf` variable that is
`undefined`; hot paths use optional chaining and do not allocate counters or
timers.

## Diagnostic Visibility Tests

The import-protection e2e suite parses terminal and build output to verify
violations, traces, and snippets.

The suite checks:

- Violations are parseable from logs.
- Build error output contains a trace.
- Warm dev traces include line numbers.
- Offending usage snippets are present for representative violations.
- Compiler-processed modules can still report original-source snippets when
  sourcemap `sourcesContent` is captured.

Browser runtime mock access diagnostics are separate from terminal diagnostics.
They should not be treated as carrying the enriched canonical trace or snippet
unless a test explicitly asserts that behavior.

## Maintainer Rules

When changing Vite import protection, ask:

1. Is this really about Vite lifecycle timing or state?
2. If not, should it move into the shared import-protection core?
3. If yes, does it belong in resolve-time detection, transform-cache handling,
   diagnostic enrichment, or bundle-time verification?
4. Does the change do avoidable source-map, AST, trace, or snippet work before a
   violation is confirmed?
5. Does the change preserve the distinction between source graph evidence,
   post-transform evidence, and bundle survival evidence?
