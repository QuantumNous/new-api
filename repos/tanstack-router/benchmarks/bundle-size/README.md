# Bundle Size Benchmarks

This workspace contains deterministic bundle-size fixtures for:

- `@tanstack/react-router`
- `@tanstack/solid-router`
- `@tanstack/vue-router`
- `@tanstack/react-start`
- `@tanstack/solid-start`

Each package has `minimal` and `full` scenarios:

- `minimal`: Small route app with `__root` + index route that renders `hello world`
- `full`: Same route shape plus a broad root-level harness that imports/uses the full hooks/components surface
- Start `full` scenarios also exercise `createServerFn`, `createMiddleware`, and `useServerFn`
- Start `deferred-hydration` scenarios match the minimal route shape and wrap the index route content in `Hydrate`

## Design Notes

- Scenarios use file-based routing as the default app style.
- Router scenarios use `@tanstack/router-plugin/vite` with `autoCodeSplitting: true`.
- Start Vite scenarios use `@tanstack/<framework>-start/plugin/vite` with router code-splitting enabled.
- React Start also includes Rsbuild scenarios using `@tanstack/react-start/plugin/rsbuild`.
- Full-surface coverage is manually maintained (no strict export-coverage gate).
- Primary metrics measure all emitted client JS chunks and are reported as raw/gzip/brotli bytes.
- Initial-load JS graph metrics are also recorded as `initialRawBytes`, `initialGzipBytes`, and `initialBrotliBytes` for context.
- Gzip for all emitted client JS is the primary tracking signal for PR deltas and historical charting.

## Local Run

```bash
pnpm nx run @benchmarks/bundle-size:build
```

Run one or more scenarios during local optimization:

```bash
pnpm nx run @benchmarks/bundle-size:build -- --scenario react-router.minimal
pnpm nx run @benchmarks/bundle-size:build -- --scenario react-router.minimal,react-router.full
```

Filtered runs build only the package projects needed by selected scenarios. Full runs build all package projects needed by all scenarios. If the required packages are already built and unchanged, skip that step:

```bash
pnpm nx run @benchmarks/bundle-size:build -- --scenario react-router.minimal --skip-package-builds
```

This writes:

- `benchmarks/bundle-size/results/current.json`
- `benchmarks/bundle-size/results/benchmark-action.json`

`current.json` includes run status, selected package build projects, per-scenario totals, per-file sizes, and the emitted JS files used for measurement. Dist paths use `scenarioDir`/`outDir`, e.g. `react-router.minimal` maps to `benchmarks/bundle-size/dist/react-router-minimal/`.

## Local Query Tools

```bash
pnpm benchmark:bundle-size:query --id react-router.minimal
pnpm benchmark:bundle-size:diff --baseline /tmp/base-current.json --id react-router.minimal
pnpm benchmark:bundle-size:history --id react-router.minimal --top-deltas 20
```

For source attribution, run an analysis build. This uses hidden source maps and writes source estimates into `current.json`; those estimates are for investigation only, not tracking.

```bash
pnpm nx run @benchmarks/bundle-size:build -- --scenario react-router.minimal --analysis
pnpm benchmark:bundle-size:analyze --id react-router.minimal --top-sources 30
```

## CI Reporting

- PR workflow generates a sticky comment with:
  - current gzip values
  - baseline delta
  - inline sparkline trend
- Pushes to `main` publish historical chart data to GitHub Pages via `benchmark-action/github-action-benchmark`.

## Manual Update Policy

When router/start public hooks/components evolve, update the corresponding `*-full/src/routes/__root.tsx` harness to keep full scenarios representative.

## Backfill Readiness

The measurement script supports optional interfaces for historical backfilling:

- `--sha`
- `--measured-at`
- `--append-history`
- `--scenario`
- `--analysis`
- `--sourcemap`
- `--skip-package-builds`

These are intended for one-off scripts that replay historical commits and append results to the same history dataset shape used for chart generation.
If `--append-history` points at a `data.js` file, output is written as `window.BENCHMARK_DATA = ...` for direct GitHub Pages compatibility.
