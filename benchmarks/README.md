# Virtualization benchmarks

Reproducible browser benchmarks comparing **@tanstack/react-virtual**, **virtua**, **react-virtuoso**, and **react-window** v2.

Same data, same scenarios, same harness — driven by Playwright against a real browser running a real Vite-built React app for each library.

## Running

```bash
# from the repo root
pnpm install
pnpm --filter @tanstack/virtual-core build
cd benchmarks
pnpm exec playwright install chromium

# Full matrix, 5 runs per cell (~10 min)
pnpm bench

# Quick subset
pnpm bench -- --runs 2 --libs tanstack,virtua --scenarios mount-fixed-10k

# Watch the browser as it runs
pnpm bench:headed
```

Results land in `benchmarks/results/<timestamp>.json` (raw, every run) and
`benchmarks/results/LATEST.md` (median table from the last run).

## How it works

```text
benchmarks/
├── src/
│   ├── main.tsx                Reads ?lib=... &scenario=...
│   ├── pages/                  One file per library; all share the same harness
│   ├── lib/
│   │   ├── dataset.ts          Deterministic item generator (LCG-seeded)
│   │   └── harness.ts          Installs window.bench.run() that every page uses
│   └── scenarios/types.ts      The fixed scenario list. Adding a row here
│                               surfaces it in every library and the runner.
├── runner/run.mjs              Playwright driver. Boots a server, runs each
│                               (lib × scenario × run), aggregates medians.
├── results/                    JSON snapshots + LATEST.md
└── package.json
```

Every library page mounts an identical dataset, registers a `HarnessHandle`,
and exposes the same `window.bench.run(scenario)` entrypoint that returns
`ScenarioMetrics`. That means the runner doesn't know or care which library
it's measuring — it just calls one global function per page.

## Scenarios

| id                        | items   | size   | dynamic | action                                                              |
| ------------------------- | ------- | ------ | ------- | ------------------------------------------------------------------- |
| `mount-fixed-1k`          | 1,000   | 30 px  | no      | idle (just mount)                                                   |
| `mount-fixed-10k`         | 10,000  | 30 px  | no      | idle                                                                |
| `mount-fixed-100k`        | 100,000 | 30 px  | no      | idle                                                                |
| `mount-dynamic-1k`        | 1,000   | varies | yes     | wait for total size to settle                                       |
| `mount-dynamic-10k`       | 10,000  | varies | yes     | wait for total size to settle                                       |
| `scroll-to-bottom-10k`    | 10,000  | 30 px  | no      | rAF-driven scroll, 1.5 s                                            |
| `fast-scroll-dynamic-10k` | 10,000  | varies | yes     | rAF-driven scroll, 1.5 s                                            |
| `jump-to-end-dynamic-10k` | 10,000  | varies | yes     | `scrollToIndex(9999)` then wait until scrollTop stable for 5 frames |

## Metrics

| field          | meaning                                                                                                                                                                                                                                                        |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mountMs`      | `React.render(...)` call → `useEffect` runs (commit complete).                                                                                                                                                                                                 |
| `firstPaintMs` | `React.render(...)` call → one rAF after commit (≈ first paint).                                                                                                                                                                                               |
| `actionMs`     | Action-specific. For scroll actions, total elapsed during the scripted scroll. For dynamic-measure, time from mount to a stable `getTotalSize()` (8 consecutive frames unchanged). For jump-to-end, time from `scrollToIndex` to position stable for 5 frames. |
| `scrollFps`    | Average FPS sampled during the scripted scroll.                                                                                                                                                                                                                |
| `longFrames`   | Count of frames with inter-frame gap > 32 ms.                                                                                                                                                                                                                  |
| `jankMs`       | Sum of frame durations > 50 ms during the action.                                                                                                                                                                                                              |
| `memoryBytes`  | `performance.memory.usedJSHeapSize` after the scenario. Chromium only; ungated by `--enable-precise-memory-info`.                                                                                                                                              |

## Latest results (medians of 5 runs each)

**Hardware**: Author's machine — see `results/<timestamp>.json` for run conditions.

### Mount time — `React.render` → commit (lower is better, ms)

| Scenario            | tanstack |  virtua | virtuoso | window |
| ------------------- | -------: | ------: | -------: | -----: |
| `mount-fixed-1k`    |  **0.8** |     0.7 |      1.8 |    2.2 |
| `mount-fixed-10k`   |      1.6 | **1.0** |      2.0 |    2.4 |
| `mount-fixed-100k`  |      6.1 | **3.1** |      5.0 |    4.4 |
| `mount-dynamic-1k`  |  **1.5** |     1.8 |      2.8 |    2.9 |
| `mount-dynamic-10k` |  **6.0** |     6.7 |      8.5 |    7.0 |

> **What we see:** TanStack is fastest on every scenario at 1k–10k items, but
> _slowest_ at 100k fixed. The audit predicted this: we eagerly populate
> `measurementsCache` (one object per item) on every mount, while virtua's
> lazy prefix-sum cache only does work for the visible window.

### Dynamic measurement — commit → stable total size (lower is better, ms)

| Scenario            | tanstack |  virtua | virtuoso |  window |
| ------------------- | -------: | ------: | -------: | ------: |
| `mount-dynamic-1k`  |      124 | **121** |      194 |     122 |
| `mount-dynamic-10k` |      118 |     118 |      188 | **116** |

> **What we see:** Roughly tied between TanStack, virtua, and react-window.
> Virtuoso takes ~60% longer because its scroll-anchoring keeps adjusting
> the inner spacer for several frames after the initial measurement pass.

### Scroll perf — fps & long frames during 1.5 s programmatic scroll

| Scenario                             | tanstack | virtua | virtuoso | window |
| ------------------------------------ | -------: | -----: | -------: | -----: |
| `scroll-to-bottom-10k` fps           |       60 |     60 |       60 |     60 |
| `fast-scroll-dynamic-10k` fps        |       60 |     60 |       60 |     60 |
| `scroll-to-bottom-10k` longFrames    |        0 |      0 |        0 |      0 |
| `fast-scroll-dynamic-10k` longFrames |        0 |      0 |        0 |      0 |

> **Caveat:** at 10k items, none of these libraries even break a sweat.
> A 1.5 s rAF-paced scroll is too gentle to expose perf differences. Real
> stress tests would need expensive item renderers and/or 100k+ items.

### Jump-to-end settle time (lower is better, ms)

| Scenario                  | tanstack | virtua | virtuoso | window |
| ------------------------- | -------: | -----: | -------: | -----: |
| `jump-to-end-dynamic-10k` |       83 |     72 |      154 | **68** |

> **What we see:** react-window is fastest. TanStack lands 15 ms behind, likely
> from the `requestAnimationFrame` reconcile loop running an extra frame or
> two before declaring the position stable. Virtuoso is 2× slower than the
> fastest because its anchoring + measurement loop takes longer to converge.

### Memory after mount (lower is better, MB)

| Scenario            | tanstack |   virtua | virtuoso | window |
| ------------------- | -------: | -------: | -------: | -----: |
| `mount-fixed-10k`   |      6.6 |  **6.4** |      6.7 |    7.0 |
| `mount-fixed-100k`  |     14.2 | **10.5** |     10.8 |   11.1 |
| `mount-dynamic-10k` |      8.1 |  **7.8** |      8.8 |    8.5 |

> **What we see:** Tight at 10k. At 100k fixed, TanStack uses ~3 MB more than
> the others — same root cause as the slow mount: we hold a `VirtualItem`
> object per item, while virtua holds two numbers per item.

## Bottom line

- **Small-to-medium variable-size lists** (the most common use case) —
  TanStack is consistently the fastest to mount, tied on dynamic measurement,
  competitive on memory.
- **Huge fixed-size lists (100k+ items)** — virtua wins decisively on mount
  time and memory because its lazy prefix-sum cache only materializes the
  visible window. TanStack's eager `measurementsCache` is the cost.
- **Scroll perf** — at the list sizes / workloads tested, all four
  libraries sustain 60 fps with zero dropped frames.
- **Jump-to-index** — react-window leads, TanStack lands ~15 ms slower,
  virtuoso 2× slower than the leader.

## Notes on fairness

- Each page is implemented with the library's _recommended_ API. For example,
  TanStack uses `useVirtualizer` + `measureElement`; virtua uses `VList` with
  the `data`/`item` props; virtuoso uses `Virtuoso` with `fixedItemHeight`
  when applicable; react-window uses `List` + `useDynamicRowHeight`.
- React 18 runs in production mode (no `<StrictMode>`).
- Dataset is deterministic (LCG-seeded) and identical across libraries.
- `--enable-precise-memory-info` + `--js-flags=--expose-gc` are passed to
  Chromium so memory readings aren't bucketed and we can force GC between
  runs.
- Medians across 5 runs are reported (raw runs in `results/<ts>.json`).
- Run on a built (`vite build`) preview server, not the dev server — so we
  measure production code paths.

## Adding a scenario

Add an entry to `SCENARIOS` in `src/scenarios/types.ts`. The runner discovers it automatically.

## Adding a library

1. Create `src/pages/MyLibPage.tsx` that registers a `HarnessHandle` (see existing pages for the contract).
2. Wire it into `src/main.tsx`'s switch.
3. Add the library name to `ALL_LIBS` in `runner/run.mjs`.

## Known limitations

- Scroll tests are programmatic (rAF-driven) and at the tested list sizes,
  every library trivially hits 60 fps. A harder test would render expensive
  items, scroll faster, or both. PRs welcome.
- Memory deltas at small list sizes (≤10k items) are within the noise floor
  of `performance.memory`.
- Single-machine numbers. The _shape_ of the comparison transfers across
  machines, the absolute values don't.
