---
name: bundle-size-optimization
description: Use when working in this repository on JS bundle size, gzip regressions, benchmark scenarios, source attribution, treeshaking, dead code elimination, or Rolldown annotations.
---

# Bundle Size Optimization

## Overview

Optimize measured client bundles, not source text. The source of truth is `@benchmarks/bundle-size:build`, `benchmarks/bundle-size/results/current.json`, and emitted JS in `benchmarks/bundle-size/dist/`.

## Commands

| Need               | Command                                                                                                                                                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full benchmark     | `CI=1 NX_DAEMON=false pnpm nx run @benchmarks/bundle-size:build --outputStyle=stream --skipRemoteCache --skipNxCache >/tmp/bundle-size-build.log 2>&1 && pnpm benchmark:bundle-size:query`                                                                           |
| One scenario       | `CI=1 NX_DAEMON=false pnpm nx run @benchmarks/bundle-size:build --outputStyle=stream --skipRemoteCache --skipNxCache -- --scenario react-router.minimal >/tmp/bundle-size-build.log 2>&1 && pnpm benchmark:bundle-size:query --id react-router.minimal`              |
| Read result        | `pnpm benchmark:bundle-size:query --id react-router.minimal`                                                                                                                                                                                                         |
| Compare results    | `pnpm benchmark:bundle-size:diff --baseline /tmp/base-current.json --id react-router.minimal`                                                                                                                                                                        |
| History deltas     | `git fetch --quiet origin gh-pages && pnpm benchmark:bundle-size:history --id react-router.minimal --top-deltas 20`                                                                                                                                                  |
| Source attribution | `CI=1 NX_DAEMON=false pnpm nx run @benchmarks/bundle-size:build --outputStyle=stream --skipRemoteCache --skipNxCache -- --scenario react-router.minimal --analysis >/tmp/bundle-size-build.log 2>&1 && pnpm benchmark:bundle-size:analyze --id react-router.minimal` |
| Symbol refs        | `pnpm ts:symbol-references -- --project packages/router-core/tsconfig.json --file packages/router-core/src/utils.ts --symbol last`                                                                                                                                   |

## Rules

- Run one Nx command at a time.
- Redirect noisy Nx build output to a log file, then print only `query`, `diff`, or `analyze` output. If the build fails, search/read the log for the error instead of printing the full log.
- Track `gzipBytes` first; also inspect `initialGzipBytes`, `rawBytes`, `brotliBytes`, `jsFiles`, and per-file `files`.
- Dist paths use `scenarioDir`/`outDir`, not metric ids: `react-router.minimal` maps to `dist/react-router-minimal/`.
- For tiny changes, measure after each candidate; gzip can move opposite raw bytes.
- To compare a base commit, run the same scenario in a separate worktree under `/var/folders/6f/2t42ntqs4yv4h6qwzbh5pmcm0000gn/T/opencode` and diff the two `current.json` files.
- Use history for prior patterns and baselines, not source attribution. It is commit-level data.
- Runtime performance and security may never be sacrificed for bundle size.
- Do not stop after the first verified win. Keep iterating through reasonable local, emitted-JS, and algorithmic candidates until measured regressions, readability, or risk rule out the remaining paths.
- When inlining helpers or simplifying non-obvious logic, preserve readability with a short comment explaining the meaning/invariant, not the mechanics.
- Before inlining or deleting a helper/function, use the TypeScript language-service script to check references: `pnpm ts:symbol-references -- --project <package>/tsconfig.json --file <decl-file> --symbol <name>`. If the helper is used elsewhere, inlining one use is usually not worth it for bundle size unless measurement proves otherwise. If no references remain, delete the helper and verify with the script.
- Run unit/types tests for the package being modified plus relevant e2e tests under `e2e/`.
- Continue optimizing until further reductions would make code unreadable/unmaintainable, or no more reductions remain. A user-provided byte target is not required.
- Be willing to make large, risky architectural or algorithmic changes, but only within the runtime, security, readability, maintainability, and test constraints above.
- If you are unsure whether to land a passing change because runtime semantics might change, add unit/e2e tests and/or ask clarifying questions. If codebase exploration can answer the question, explore instead. For each question, provide your recommended answer.
- If runtime performance implications are unclear, add a focused Vitest benchmark (`*.bench.ts`) comparing candidate implementations across realistic and edge-case inputs, like `packages/router-core/tests/closing-tag-detection.bench.ts`; verify implementations produce identical results before `bench()` cases.
- If you learn a reusable bundle-size pattern, hit a tooling gap, or lack analysis capability, ask the user before updating this skill or the benchmark scripts.

## Benchmark Rules

- During iteration, pick one bundle-size scenario that is most likely to contain the changed code. Use `react-router.minimal` for router-core and react-router changes by default; use `solid-router.minimal` for solid-router changes, `vue-router.minimal` for vue-router changes, `react-start.minimal` or `react-start.rsbuild.minimal` for React Start changes, and `solid-start.minimal` for Solid Start changes.
- Override the default targeted scenario when code is only pulled into a fuller scenario. For example, if a hook/function is referenced only by `solid-router.full`, iterate on `solid-router.full` instead of `solid-router.minimal`.
- If a change can affect several package families, pick the smallest scenario that imports the shared code for quick iteration, then spot-check the next most likely affected family before finalizing.
- Before finalizing, run the full bundle-size benchmark without `--scenario` and compare all scenarios. Look for outliers/anomalies even when the targeted scenario improved.
- Benchmark the changed mechanism directly, not just the public API around it.
- Keep broad realistic scenarios as smoke/regression coverage; use focused cases for proof.
- Compare baseline and current with the same benchmark file. Use a separate worktree when only implementation should differ.
- Run noisy benchmark families separately with `-t <pattern>`; all-in-one suites can perturb tiny operations.
- For branchy fast paths, include best-case, worst-case, and expected mixed distributions.
- Batch ultra-fast operations inside one benchmark iteration when single calls are dominated by timer/outlier noise.
- Read `hz`, `mean`, `p99`/`p999`, `rme`, and samples together. Do not trust one noisy `hz` value.
- Treat high `rme` or large p999 outliers as directional only; rerun narrower cases before deciding.
- Name cases after the behavior under test so future readers know what result matters.
- Verify correctness before timed cases so benchmarks do not measure invalid or dead paths.

## Attribution Round

Before calling an optimization final, prove which exact production hunks should remain:

1. Snapshot the unoptimized baseline and the full candidate metrics.
2. Split the production diff into logical hunks or dependent hunk groups. Include syntax-only and readability-only edits if they can affect emitted code.
3. Benchmark each independent hunk alone against the same baseline. Benchmark relevant combinations when hunks only matter together or interact.
4. For each hunk/group, record bundle metrics and focused performance results when runtime cost could change.
5. Keep only changes that improve bundle size or performance, or are required for correctness/tests/style and do not regress measured results. Revert neutral or harmful optimization-only changes.
6. Rebuild and remeasure the final composed version. It must not be larger or slower than the pre-attribution candidate unless the retained change is explicitly required for correctness or style.

## Optimization Loop

1. Measure baseline scenario.
2. Inspect diff, emitted JS, per-file sizes, and analysis sources if needed.
3. Analyze the algorithm before syntax. Identify redundant loops, duplicate branches, repeated scans/slices/lowercasing, allocation-heavy paths, search order, and data-shape choices.
4. Make the smallest behavior-preserving algorithmic edit that removes work or code shape first; use syntax-only edits only after algorithmic candidates are exhausted.
5. Re-measure and keep only proven wins.
6. Run package unit/types, relevant e2e, and `git diff --check`.
7. Run the attribution round, then the post-optimization coverage/perf workflow before finalizing.

## Algorithmic Pass

For hot files, split the code into phases and optimize each phase by work removed, not characters removed:

- Parsing/scanning: prefer one pass over helper scans plus substring allocation; keep offsets into source strings when possible.
- Tree/building: fuse identical node-creation branches when the data shape is shared; cache repeated route/options fields in locals.
- Matching/search: preserve priority order, but merge candidate loops only when stack push order stays identical; avoid allocation in suffix/prefix checks unless correctness needs it.
- Extraction/validation: compute params lazily and carry state only where needed; do not reuse partial params across skipped/pathless branches unless covered by tests.
- Sorting/scoring: replace helper calls and comparator ladders only when measured and still readable.
- Sorting/tree post-processing: if a full tree walk only sorts sparse child arrays, record arrays when they become sortable (length reaches 2) during construction, then sort the recorded arrays once.

After each candidate, run focused perf benchmarks before bundle measurement. Reject wins that hide runtime regressions or make invariants hard to audit.

## Post-Optimization Coverage/Perf Workflow

When done optimizing:

1. Spawn 5 subagents to review the optimization diff against existing tests. Ask each to identify missing unit test cases that could fail with the current changes or newly uncovered edge cases, and missing performance benchmarks that could hide regressions.
2. If a possible regression is unclear, ask the user or explore the codebase until the expected behavior is clear.
3. Use their input to add focused unit tests and benchmarks.
4. Commit only the tests/benchmarks/supporting test-script changes.
5. Stash the implementation changes.
6. Run tests, performance benchmarks, and the relevant bundle-size measurement, then write BEFORE results to `RESULT-optimization-{topic}.md`.
7. Pop the implementation changes.
8. Run the same tests, performance benchmarks, and bundle-size measurement, then append AFTER results to the same file.
9. When reviewing benchmark output, consider statistical quality: standard deviation, margin of error, variance/noise, sample count, and percentiles. Re-run or narrow conclusions when results are noisy.
10. Compare BEFORE and AFTER. If anything regressed, iterate until green or revert the regression.

Useful patterns: remove prod-only strings, remove unused exports, flatten wrappers, inline one-use helpers, avoid duplicate literals, improve treeshaking boundaries, simplify branches after preserving behavior.

## DCE And Annotations

Rolldown removes code only when unused and side-effect-free. Property reads may trigger getters; storage/global access can observe or throw.

| Annotation                                | Valid                                                                       | Unsafe                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `/* @__PURE__ */ call()`                  | immediately before a call/new expression whose unused result can be dropped | declarations, property reads, setup, storage, DOM/history/listener code            |
| `/* @__NO_SIDE_EFFECTS__ */ function f()` | every call of the function is side-effect-free                              | functions touching globals, storage, DOM, history, subscriptions, warnings, caches |
| `sideEffects`/module flags                | module has no import-time effects when unused                               | CSS, polyfills, storage hydration, DOM/history setup                               |

## Red Flags

- Using package `test:build` as a size proxy.
- Trusting source bytes or raw bytes instead of measured `gzipBytes`.
- Inspecting `dist/<metric-id>` instead of `dist/<scenarioDir>`.
- Adding DCE annotations to effectful code because the byte target is small.
- Skipping behavior or benchmark tests because the change is “only bundle size.”
- Skipping hunk-level attribution and keeping changes only because the full candidate improved.
- Trading runtime performance, security, readability, or maintainability for bytes.
