---
name: rsbuild-performance-profiling
description: Use when profiling, analyzing, reporting, or optimizing Rsbuild performance, including build, dev server, rebuild, static asset serving, memory usage, and CPU profile analysis.
---

# Rsbuild Performance Profiling

## Workflow

1. Define the target scenario before collecting data:

   - operation: build, dev startup, rebuild, request serving, memory usage, or another explicit flow
   - benchmark project or fixture
   - metric: wall time, CPU time, self time, allocations, RSS, heap
   - success threshold, if the user provided one

2. Record the baseline first. Keep runtime, package manager, dependencies, environment variables, command flags, and input project unchanged for comparisons.

3. Save raw artifacts when available, such as CPU profiles, heap snapshots, logs, timing output, and benchmark commands. Do not rely only on subjective observations.

4. Separate costs by ownership:

   - Rsbuild code paths
   - Rspack or loader/plugin internals
   - third-party dependencies
   - user project code or benchmark fixture code

5. Rank findings by measured impact. Prefer self time for direct optimization targets and total time for understanding call-chain impact.

6. If implementing an optimization, keep behavior unchanged unless the user explicitly asked for a behavior change. Prefer small, measurable changes over broad refactors.

7. Re-run the same benchmark after changes. Report before/after numbers, absolute delta, percentage delta, and any variance or confidence limits you can observe.

## Analysis Rules

- Treat the user's supplied profiles, reports, and benchmark numbers as the source of truth for that task.
- Do not claim a performance win without comparable before/after measurements.
- Do not optimize generated output, dependencies, or benchmark fixture code unless the user asked for that scope.
- For CPU profiles, call out both hot functions and why they are on the hot path.
- For memory tasks, distinguish peak usage from stable usage after warmup or repeated rebuilds.

## Output

Return a concise report with:

- benchmark command or data source
- top findings ordered by impact
- Rsbuild-owned optimization opportunities
- changes made, if any
- validation results and remaining risk
