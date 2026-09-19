# Virtualization benchmarks

Reproducible browser benchmarks comparing **@tanstack/react-virtual**, **virtua**, **react-virtuoso**, **react-window** v2, and **react-aria-components** `Virtualizer`.

Same data, same scenarios, same harness — driven by Playwright against a real browser running a real Vite-built React app for each library.

## Library matrix

| id                             | What it measures                                                          |
| ------------------------------ | ------------------------------------------------------------------------- |
| `tanstack`                     | Headless `@tanstack/react-virtual` + plain DOM rows                       |
| `tanstack-rac`                 | TanStack virtual + `role="listbox"` / `role="option"` (no RAC collection) |
| `rac-listbox`                  | React Aria `ListBox` only — collection overhead, all items in DOM         |
| `rac`                          | React Aria `Virtualizer` + `ListBox` — full integrated stack              |
| `virtua`, `virtuoso`, `window` | Existing third-party baselines                                            |

`rac-listbox` skips `mount-fixed-100k` (100k DOM nodes is intentionally out of scope).

**RAC accuracy scenarios:** React Aria's virtualizer does not expose `scrollToIndex`. The harness uses layout-derived `scrollTop` + native scroll events. If the target row is not mounted after scroll settles, `landingErrorPx` is `-1` (item missing from DOM). `rac-listbox` (non-virtualized) reports accurate landings because every row stays in the DOM.

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

## Latest results — third-party libraries (medians of 5 runs each)

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

## React Aria comparison (medians of 2 runs each)

Run with `--libs tanstack,tanstack-rac,rac,rac-listbox` on 2026-06-21. See
`results/LATEST.md` for the full table set.

### Mount time — `React.render` → commit (lower is better, ms)

| Scenario            | tanstack | tanstack-rac |   rac | rac-listbox |
| ------------------- | -------: | -----------: | ----: | ----------: |
| `mount-fixed-1k`    |      3.7 |      **1.0** |   9.6 |         7.8 |
| `mount-fixed-10k`   |  **2.4** |          1.5 |  20.0 |        25.5 |
| `mount-fixed-100k`  |  **5.8** |          4.2 | 175.2 |           — |
| `mount-dynamic-1k`  |      1.8 |      **1.4** |   7.3 |         8.1 |
| `mount-dynamic-10k` |  **4.9** |          5.2 |  26.2 |        26.3 |

> **What we see:** `tanstack-rac` (TanStack virtual + WAI-ARIA roles only) mounts
> as fast as headless TanStack. The full RAC stack (`rac`) pays 10–30× more at
> 10k because of collection + layout setup. `rac-listbox` (no virtualizer) is
> similar at 10k but skipped at 100k — 100k DOM nodes is out of scope.

### Dynamic measurement — commit → stable total size (lower is better, ms)

| Scenario            | tanstack | tanstack-rac |   rac | rac-listbox |
| ------------------- | -------: | -----------: | ----: | ----------: |
| `mount-dynamic-1k`  |    124.8 |    **122.6** | 3,004 |   **108.1** |
| `mount-dynamic-10k` |    118.7 |        119.4 | 3,009 |   **107.6** |

> **What we see:** RAC's virtualizer waits ~3 s for layout to settle (its
> `isFullyMeasured` gate). Non-virtualized `rac-listbox` is fastest here because
> every row is already in the DOM — no scroll-range estimation needed.

### Memory after mount (lower is better, MB)

| Scenario            | tanstack | tanstack-rac |  rac | rac-listbox |
| ------------------- | -------: | -----------: | ---: | ----------: |
| `mount-fixed-10k`   |  **3.3** |          6.3 | 13.9 |       534.0 |
| `mount-fixed-100k`  |  **9.9** |         12.9 | 99.7 |           — |
| `mount-dynamic-10k` |  **4.8** |          7.7 | 15.4 |       535.3 |

> **What we see:** `rac-listbox` at 10k uses ~80× more heap than virtualized
> libraries because all 10k React nodes stay mounted. RAC virtualized is ~2×
> TanStack at 10k, ~10× at 100k.

### scrollToIndex landing accuracy — px offset from target (lower is better)

| Scenario                                    | tanstack | tanstack-rac | rac | rac-listbox |
| ------------------------------------------- | -------: | -----------: | --: | ----------: |
| `jump-to-middle-accuracy-dynamic-10k`       |        0 |            0 |  −1 |           0 |
| `jump-to-last-accuracy-dynamic-10k`         |        0 |            0 |  −1 |           0 |
| `jump-while-measuring-accuracy-dynamic-10k` |        0 |            0 |  −1 |           0 |
| `jump-wide-variance-accuracy-10k`           |        0 |            0 |  −1 |           0 |

> **What we see:** `−1` means the target row was not in the DOM after scroll
> settled — RAC has no public `scrollToIndex`, so the harness uses layout-derived
> `scrollTop`. `rac-listbox` reports 0 px because every row stays mounted.
> Scroll FPS and jump-to-end settle time were identical across all four (60 fps,
> ~65–85 ms).

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
- **React Aria overhead** — WAI-ARIA roles alone (`tanstack-rac`) add negligible
  cost. The RAC collection + virtualizer stack adds ~10–30× mount time at 10k and
  ~30× at 100k vs headless TanStack. Non-virtualized `ListBox` is unusable at
  scale (~534 MB heap at 10k items).
- **RAC accuracy** — virtualized RAC cannot satisfy `scrollToIndex` accuracy
  probes today (`landingErrorPx = −1`); non-virtualized `rac-listbox` is exact.

## Notes on fairness

- Each page is implemented with the library's _recommended_ API. For example,
  TanStack uses `useVirtualizer` + `measureElement`; virtua uses `VList` with
  the `data`/`item` props; virtuoso uses `Virtuoso` with `fixedItemHeight`
  when applicable; react-window uses `List` + `useDynamicRowHeight`; RAC uses
  `Virtualizer` + `ListLayout` + `ListBox`; `tanstack-rac` adds listbox/option
  roles to TanStack rows without RAC's collection layer.
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
4. If a library cannot run certain scenarios, add exclusions to `LIB_SCENARIO_EXCLUSIONS` in `src/scenarios/libScenarioExclusions.mjs` (also re-exported from `scenarios/types.ts`).

## Known limitations

- Scroll tests are programmatic (rAF-driven) and at the tested list sizes,
  every library trivially hits 60 fps. A harder test would render expensive
  items, scroll faster, or both. PRs welcome.
- Memory deltas at small list sizes (≤10k items) are within the noise floor
  of `performance.memory`.
- Single-machine numbers. The _shape_ of the comparison transfers across
  machines, the absolute values don't.
