# updateSpec Effects Phase 3 Marker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route marker array removal through the scoped `localOnly + component` effect path so marker exit animation does not trigger unrelated series/data/label updates.

**Architecture:** Keep marker exit ownership in VRender via `releaseWithExitAnimation`. In VChart, mark removed marker components as component-local effects, skip later chart update stages only when no legacy global flags are present, and preserve existing remake behavior for non-marker array changes.

**Tech Stack:** TypeScript, Jest manual ticker animation regressions, VChart `BaseChart.updateSpec`, scoped update effects.

---

### Task 1: Mark Removed Marker Components As Local Effects

**Files:**
- Modify: `packages/vchart/src/chart/base/base-chart.ts`

- [x] **Step 1: Import local-only predicate**

```ts
import { calculateChartSize, isUpdateSpecResultLocalOnly, mergeUpdateResult } from '../util';
```

- [x] **Step 2: Change removed marker result**

In `updateComponentSpec`, replace marker removal result flags:

```ts
result.change = true;
result.effects = {
  ...result.effects,
  component: true,
  localOnly: true
};
```

Do not set `reRender` for removed marker components.

### Task 2: Let BaseChart Stop After Local-Only Component Updates

**Files:**
- Modify: `packages/vchart/src/chart/base/base-chart.ts`

- [x] **Step 1: Move chart layout dirtying out of the updateSpec entry**

Remove the unconditional entry call:

```ts
this.setLayoutTag(true, null, false);
```

- [x] **Step 2: Preserve layout dirtying for early remake returns**

Before each early `result.reMake = true; return result;`, call:

```ts
this.setLayoutTag(true, null, false);
```

This applies to type changes, key-set changes, and non-marker array length changes.

- [x] **Step 3: Stop before series/data/domain when update is local-only**

After `updateComponentSpec(result)` and the existing remake check, add:

```ts
if (isUpdateSpecResultLocalOnly(result)) {
  return result;
}
this.setLayoutTag(true, null, false);
```

Then continue with `updateSeriesSpec`, `reInit`, `updateDataSpec`, and domain update.

### Task 3: Add Marker Deletion Regression

**Files:**
- Modify: `packages/vchart/__tests__/unit/animation/manual-ticker.test.ts`

- [x] **Step 1: Add scatter label helper**

```ts
const getScatterDataLabels = (chart: VChart) =>
  getAnimatedLabelTexts(chart).filter(graphic => {
    return typeof graphic.attribute?.text === 'number' && getGraphicFinalAttribute(graphic).x !== undefined;
  });
```

- [x] **Step 2: Add scatter marker-removal spec helper**

Add a scatter spec with `label.visible: true`, a single `markLine`, and `animationExit: fadeOut`. The `visible=false` variant must set `markLine: []` while keeping every other field identical.

- [x] **Step 3: Add the regression test**

The test should:

1. Render the visible-marker spec.
2. Advance past marker appear.
3. Capture scatter data label numeric texts.
4. `updateSpecSync` to the marker-empty spec.
5. Tick to the middle of update duration.
6. Assert label texts are unchanged.
7. Let the existing marker exit tests continue to assert fade-out behavior.

### Task 4: Verify Phase 3

**Files:**
- Verify only.

- [x] **Step 1: Run focused animation tests**

```bash
cd packages/vchart
./node_modules/.bin/jest __tests__/unit/animation/manual-ticker.test.ts --runInBand -t "does not replay scatter data label|exit fade-out"
```

Expected: PASS.

- [x] **Step 2: Run full manual ticker and updateSpec suites**

```bash
cd packages/vchart
./node_modules/.bin/jest __tests__/unit/animation/manual-ticker.test.ts __tests__/unit/core/update-spec.test.ts __tests__/unit/core/update-effects.test.ts --runInBand
```

Expected: PASS.

- [x] **Step 3: Run previous regression guard**

```bash
cd packages/vchart
./node_modules/.bin/jest __tests__/unit/chart/word-cloud.test.ts --runInBand
```

Expected: PASS.

- [x] **Step 4: Run lint and typecheck**

```bash
cd packages/vchart
./node_modules/.bin/eslint src/chart/base/base-chart.ts __tests__/unit/animation/manual-ticker.test.ts
./node_modules/.bin/tsc --noEmit --project tsconfig.json
```

Expected: eslint exits 0; typecheck exits 0.
