# ESLint Plugin Start (e2e)

Runs end-to-end linting tests against `@tanstack/eslint-plugin-start`.

## Prereqs

- `pnpm install` at repo root
- `hyperfine` installed (used for perf benchmarking)

## Tests

- Unit-style e2e via Vitest: `pnpm -C e2e/eslint-plugin-start test:e2e`
- Lint all fixtures: `pnpm -C e2e/eslint-plugin-start test:lint`

## Perf benchmark (hyperfine)

Generates synthetic fixtures (gitignored) and measures lint time.

### Modes

- `small`: no noise files, just a route + component chain. Measures the cost of the "real" rule work.
- `huge`: thousands of irrelevant files + a route + component chain. Measures gating overhead across a large codebase.

### Bench commands

- `pnpm -C e2e/eslint-plugin-start perf:bench:small`
- `pnpm -C e2e/eslint-plugin-start perf:bench:huge`

Optional env vars (huge mode):

- `PERF_NOISE_FILES=5000` (default)
- `PERF_CHAIN_DEPTH=50` (default)

Notes:

- `perf:lint` only targets `src/perf/generated/**` so results aren’t dominated by other fixtures.
- Use a fresh terminal and close editors/watchers for stable numbers.
- If you want to compare versions, run the same command after each change and keep env vars constant.
- Optional profiling (writes a `*.cpuprofile` file):
  - `node --cpu-prof --cpu-prof-name=cpu.cpuprofile ./node_modules/eslint/bin/eslint.js "src/perf/generated/**/*.{ts,tsx}"`
