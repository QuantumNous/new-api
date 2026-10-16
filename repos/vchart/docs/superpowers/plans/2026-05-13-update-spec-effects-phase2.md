# updateSpec Effects Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let VChart read scoped update effects for explicit local-only updates while preserving legacy flag behavior.

**Architecture:** Keep old `reMake/reCompile/reRender/reSize/change` flags as the compatibility path. Add a local-only predicate derived from normalized effects, then use it to skip render, model `reInit`, and chart `reDataFlow` only when an updater explicitly returns `effects.localOnly`.

**Tech Stack:** TypeScript, Jest, VChart `IUpdateSpecResult`, `normalizeUpdateSpecEffects`, `updateCustomConfigAndRerender`, `_updateModelSpec`.

---

### Task 1: Add Local-Only Effect Predicate

**Files:**
- Modify: `packages/vchart/src/chart/util.ts`
- Test: `packages/vchart/__tests__/unit/chart/update-result.test.ts`

- [x] **Step 1: Add the helper after `normalizeUpdateSpecEffects`**

```ts
export function isUpdateSpecResultLocalOnly(result: IUpdateSpecResult): boolean {
  const effects = normalizeUpdateSpecEffects(result);

  return (
    !!effects.localOnly &&
    !effects.remake &&
    !effects.compile &&
    !effects.render &&
    !effects.layout &&
    !effects.data &&
    !effects.scaleDomain &&
    !effects.series &&
    !result.reTransformSpec &&
    !result.reAnimate &&
    !result.changeTheme &&
    !result.changeBackground
  );
}
```

- [x] **Step 2: Extend `update-result.test.ts`**

```ts
import {
  isUpdateSpecResultLocalOnly,
  mergeUpdateResult,
  normalizeUpdateSpecEffects
} from '../../../src/chart/util';
```

Add tests:

```ts
it('treats explicit local-only component effects as local', () => {
  expect(
    isUpdateSpecResultLocalOnly(createResult({ change: true, effects: { localOnly: true, component: true } }))
  ).toBe(true);
});

it('does not treat legacy render or compile work as local-only', () => {
  expect(isUpdateSpecResultLocalOnly(createResult({ reRender: true, effects: { localOnly: true } }))).toBe(false);
  expect(isUpdateSpecResultLocalOnly(createResult({ reCompile: true, effects: { localOnly: true } }))).toBe(false);
});
```

### Task 2: Gate VChart Render For Local-Only Updates

**Files:**
- Modify: `packages/vchart/src/core/vchart.ts`
- Test: `packages/vchart/__tests__/unit/core/update-effects.test.ts`

- [x] **Step 1: Import the predicate**

```ts
import { calculateChartSize, isUpdateSpecResultLocalOnly, mergeUpdateResult } from '../chart/util';
```

- [x] **Step 2: Skip render after no-op recompile work**

```ts
this._reCompile(updateSpecResult as IUpdateSpecResult);
if (isUpdateSpecResultLocalOnly(updateSpecResult as IUpdateSpecResult)) {
  return this as unknown as IVChart;
}
if (sync) {
  return this._renderSync(option);
}
```

- [x] **Step 3: Add render-gate tests**

Create `packages/vchart/__tests__/unit/core/update-effects.test.ts`:

```ts
import { default as VChart } from '../../../src';
import { createDiv, removeDom } from '../../util/dom';

const createSpec = () =>
  ({
    type: 'bar',
    data: [{ id: 'data', values: [{ x: 'A', y: 1 }] }],
    xField: 'x',
    yField: 'y'
  } as any);

describe('vchart scoped update effects', () => {
  let container: HTMLElement;
  let dom: HTMLElement;

  beforeEach(() => {
    container = createDiv();
    dom = createDiv(container);
  });

  afterEach(() => {
    removeDom(container);
  });

  it('skips render for explicit local-only updates', () => {
    const chart = new VChart(createSpec(), { dom, animation: false });
    const renderSync = jest.spyOn(chart as any, '_renderSync');

    try {
      chart.updateCustomConfigAndRerender(
        { change: true, reMake: false, effects: { localOnly: true, component: true } },
        true
      );

      expect(renderSync).not.toHaveBeenCalled();
    } finally {
      renderSync.mockRestore();
      chart.release();
    }
  });

  it('keeps legacy change-only updates rendering', () => {
    const chart = new VChart(createSpec(), { dom, animation: false });
    const renderSync = jest.spyOn(chart as any, '_renderSync').mockReturnValue(chart as any);

    try {
      chart.updateCustomConfigAndRerender({ change: true, reMake: false }, true);

      expect(renderSync).toHaveBeenCalledTimes(1);
    } finally {
      renderSync.mockRestore();
      chart.release();
    }
  });
});
```

### Task 3: Gate Model ReInit And Dataflow For Local-Only Updates

**Files:**
- Modify: `packages/vchart/src/core/vchart.ts`
- Test: `packages/vchart/__tests__/unit/core/update-effects.test.ts`

- [x] **Step 1: Update `_updateModelSpec`**

```ts
const result = model.updateSpec(spec);
const localOnly = isUpdateSpecResultLocalOnly(result);

if (!localOnly) {
  model.reInit(spec);
  if (result.change || result.reCompile || result.reMake || result.reSize || result.reRender) {
    this._chart.reDataFlow();
  }
}
```

- [x] **Step 2: Add model-gate tests**

Append to `update-effects.test.ts`:

```ts
it('skips model reInit and chart dataflow for explicit local-only model updates', () => {
  const chart = new VChart(createSpec(), { dom, animation: false });
  const model = {
    updateSpec: jest.fn(() => ({ change: true, reMake: false, effects: { localOnly: true, component: true } })),
    reInit: jest.fn()
  };
  const chartModel = { reDataFlow: jest.fn(), release: jest.fn() };
  const rerender = jest.spyOn(chart as any, 'updateCustomConfigAndRerender').mockReturnValue(chart as any);

  try {
    (chart as any)._chart = chartModel;
    (chart as any)._updateModelSpec(model, { visible: false }, true);

    expect(model.updateSpec).toHaveBeenCalledWith({ visible: false });
    expect(model.reInit).not.toHaveBeenCalled();
    expect(chartModel.reDataFlow).not.toHaveBeenCalled();
    expect(rerender).toHaveBeenCalled();
  } finally {
    rerender.mockRestore();
    chart.release();
  }
});

it('keeps legacy model updates running reInit and dataflow', () => {
  const chart = new VChart(createSpec(), { dom, animation: false });
  const model = {
    updateSpec: jest.fn(() => ({ change: true, reMake: false })),
    reInit: jest.fn()
  };
  const chartModel = { reDataFlow: jest.fn(), release: jest.fn() };
  const rerender = jest.spyOn(chart as any, 'updateCustomConfigAndRerender').mockReturnValue(chart as any);

  try {
    (chart as any)._chart = chartModel;
    (chart as any)._updateModelSpec(model, { visible: false }, true);

    expect(model.reInit).toHaveBeenCalledWith({ visible: false });
    expect(chartModel.reDataFlow).toHaveBeenCalledTimes(1);
    expect(rerender).toHaveBeenCalled();
  } finally {
    rerender.mockRestore();
    chart.release();
  }
});
```

### Task 4: Verify Phase 2

**Files:**
- Verify only.

- [x] **Step 1: Run new and related tests**

```bash
cd packages/vchart
./node_modules/.bin/jest __tests__/unit/chart/update-result.test.ts __tests__/unit/core/update-effects.test.ts __tests__/unit/core/update-spec.test.ts --runInBand
```

Expected: PASS.

- [x] **Step 2: Run animation regression tests**

```bash
cd packages/vchart
./node_modules/.bin/jest __tests__/unit/animation/manual-ticker.test.ts --runInBand
```

Expected: PASS for the current branch baseline.

- [x] **Step 3: Run lint and typecheck**

```bash
cd packages/vchart
./node_modules/.bin/eslint src/model/interface.ts src/chart/util.ts src/core/vchart.ts __tests__/unit/chart/update-result.test.ts __tests__/unit/core/update-effects.test.ts
./node_modules/.bin/tsc --noEmit --project tsconfig.json
```

Expected: eslint exits 0; typecheck exits 0.
